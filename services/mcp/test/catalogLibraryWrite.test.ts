import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyCatalogReferenceUpsert,
  applyCatalogStyleUpdate,
  previewCatalogReferenceUpsert,
  previewCatalogShotJobUpsert,
  previewCatalogStyleUpdate,
} from "../src/db/catalog";
import {
  applyCatalogReferenceUpsertResult,
  applyCatalogStyleUpdateResult,
  previewCatalogReferenceUpsertResult,
  previewCatalogShotlistUpsertResult,
  previewCatalogStyleUpdateResult,
  referenceUpsertPreviewInput,
  shotlistUpsertPreviewInput,
  styleUpdatePreviewInput,
} from "../src/tools/catalog/libraryWrite";
import { MCP_TOOLS } from "../src/mcp/registry";

const ctx = { userId: "user-1", organizationId: "org-1" };
const previewId = "6b461c9c-dc68-4189-9383-fd548997e9b5";
const expiresAt = "2026-11-22T10:15:00Z";

function fakeAdmin(data: unknown) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data, error: null };
    },
  };
  return { admin: admin as never, calls };
}

const sign = async (_ctx: unknown, tool: string, id: string, exp: string) => ({
  confirm_token: `token:${tool}:${id}`,
  expires_at: exp,
});

describe("catalog library write inputs", () => {
  it("accepts a style box change and rejects bad keys or extra fields", () => {
    expect(styleUpdatePreviewInput.safeParse({ field_key: "vo", body: "Santai", mode: "append" }).success).toBe(true);
    expect(styleUpdatePreviewInput.safeParse({ field_key: "VO", body: "x" }).success).toBe(false);
    expect(styleUpdatePreviewInput.safeParse({ field_key: "vo", body: "x", mode: "delete" }).success).toBe(false);
    expect(styleUpdatePreviewInput.safeParse({ field_key: "vo", body: "x".repeat(4001) }).success).toBe(false);
    expect(styleUpdatePreviewInput.safeParse({ field_key: "vo", body: "x", organization_id: "o" }).success).toBe(false);
  });

  it("needs an external id and a document object", () => {
    expect(referenceUpsertPreviewInput.safeParse({ external_id: "r4", document: { id: "r4", judul: "A" } }).success).toBe(true);
    expect(referenceUpsertPreviewInput.safeParse({ external_id: "r 4", document: {} }).success).toBe(false);
    expect(referenceUpsertPreviewInput.safeParse({ external_id: "r4", document: [] }).success).toBe(false);
    expect(shotlistUpsertPreviewInput.safeParse({ external_id: "job-1", document: { job_id: "job-1", shots: [] } }).success).toBe(true);
    expect(shotlistUpsertPreviewInput.safeParse({ external_id: "job-1" }).success).toBe(false);
  });
});

describe("catalog library write flow", () => {
  it("signs a style preview for the style tool and sends the session org", async () => {
    const { admin, calls } = fakeAdmin({
      field_key: "vo",
      mode: "append",
      is_new: false,
      before: "Santai",
      after: "Santai\nPelan",
      preview_id: previewId,
      expires_at: expiresAt,
    });
    const result = await previewCatalogStyleUpdateResult(
      ctx as never,
      { field_key: "vo", body: "Pelan", mode: "append" },
      (identity, input) => previewCatalogStyleUpdate(admin, identity, input),
      sign as never,
    );
    expect(calls[0].fn).toBe("mcp_preview_catalog_style_update");
    expect(calls[0].args.p_organization_id).toBe("org-1");
    expect(calls[0].args.p_input).toEqual({ field_key: "vo", body: "Pelan", mode: "append" });
    expect(result.confirm_token).toBe(`token:catalog.style.update:${previewId}`);
    expect(result).not.toHaveProperty("preview_id");
    expect(result.after).toBe("Santai\nPelan");
    expect(String(result.next_step)).toContain("catalog.style.update");
  });

  it("saves only through a verified token for the same tool", async () => {
    const { admin, calls } = fakeAdmin({ saved: true, field_key: "vo", is_new: false, before: "a", after: "b" });
    const seen: string[] = [];
    const saved = await applyCatalogStyleUpdateResult(
      ctx as never,
      { confirm_token: "tok-0123456789abcdefghij" },
      async (_c, tool, token) => {
        seen.push(`${tool}:${token}`);
        return { previewId } as never;
      },
      (identity, id) => applyCatalogStyleUpdate(admin, identity, id),
    );
    expect(seen).toEqual(["catalog.style.update:tok-0123456789abcdefghij"]);
    expect(calls[0].fn).toBe("mcp_apply_catalog_style_update");
    expect(calls[0].args.p_preview_id).toBe(previewId);
    expect(saved.saved).toBe(true);
    await expect(applyCatalogStyleUpdateResult(ctx as never, {}, async () => ({}) as never, async () => ({}) as never))
      .rejects.toThrow("invalid_input");
  });

  it("reports kept and unlinked reference images", async () => {
    const { admin, calls } = fakeAdmin({
      external_id: "r4",
      is_new: false,
      before: { judul: "Lama", beats: 3, mg: 1 },
      after: { judul: "Baru", beats: 2, mg: 1 },
      changed_keys: ["beats", "judul"],
      images_kept: 3,
      images_unlinked: ["org/b3.jpg"],
      preview_id: previewId,
      expires_at: expiresAt,
    });
    const result = await previewCatalogReferenceUpsertResult(
      ctx as never,
      { external_id: "r4", document: { id: "r4", judul: "Baru" } },
      (identity, input) => previewCatalogReferenceUpsert(admin, identity, input),
      sign as never,
    );
    expect(calls[0].fn).toBe("mcp_preview_catalog_reference_upsert");
    expect(result.images_unlinked).toEqual(["org/b3.jpg"]);
    expect(result.confirm_token).toBe(`token:catalog.reference.upsert:${previewId}`);
    expect(String(result.next_step)).toContain("images_unlinked");

    const apply = fakeAdmin({ saved: true, external_id: "r4", is_new: false, beats: 2, mg: 1, images_kept: 3, images_unlinked: [] });
    const saved = await applyCatalogReferenceUpsertResult(
      ctx as never,
      { confirm_token: "tok-0123456789abcdefghij" },
      async () => ({ previewId }) as never,
      (identity, id) => applyCatalogReferenceUpsert(apply.admin, identity, id),
    );
    expect(apply.calls[0].fn).toBe("mcp_apply_catalog_reference_upsert");
    expect(saved.images_kept).toBe(3);
  });

  it("signs a shot list preview with its shot diff", async () => {
    const { admin, calls } = fakeAdmin({
      external_id: "job-1",
      is_new: true,
      before: null,
      after: { judul: "Job", arsip: false, shots: 2 },
      shots_diff: { added: ["s1", "s2"], removed: [], changed: [] },
      preview_id: previewId,
      expires_at: expiresAt,
    });
    const result = await previewCatalogShotlistUpsertResult(
      ctx as never,
      {
        external_id: "job-1",
        document: {
          job_id: "job-1",
          shots: [
            { id: "s1", action: "Close-up of the bowl.", fotos: ["foto/a.jpg"] },
            { id: "s2", action: "Wide shot of the street.", fotos: [] },
          ],
        },
      },
      (identity, input) => previewCatalogShotJobUpsert(admin, identity, input),
      sign as never,
    );
    expect(calls[0].fn).toBe("mcp_preview_catalog_shotlist_upsert");
    expect(result.shots_diff).toEqual({ added: ["s1", "s2"], removed: [], changed: [] });
    expect(result.confirm_token).toBe(`token:catalog.shotlist.upsert:${previewId}`);
  });

  it("does not call the database on bad input", async () => {
    const { admin, calls } = fakeAdmin({});
    await expect(previewCatalogStyleUpdateResult(
      ctx as never,
      { field_key: "vo" },
      (identity, input) => previewCatalogStyleUpdate(admin, identity, input),
      sign as never,
    )).rejects.toThrow("invalid_input");
    expect(calls).toHaveLength(0);
  });
});

describe("catalog library write registry and migration", () => {
  it("registers the save tools as content writes that mutate", () => {
    for (const name of ["catalog.style.update", "catalog.reference.upsert", "catalog.shotlist.upsert"] as const) {
      const tool = MCP_TOOLS.find((item) => item.name === name);
      expect(tool?.scopes).toEqual(["content:write"]);
      expect((tool as { mutates?: boolean } | undefined)?.mutates).toBe(true);
      expect(MCP_TOOLS.find((item) => item.name === `${name}.preview`)).toBeTruthy();
    }
  });

  it("grants the functions to service_role only and keeps stored image paths", () => {
    const sql = fs.readFileSync(
      new URL("../../../supabase/migrations/20261123000000_mcp_catalog_library_write.sql", import.meta.url),
      "utf8",
    );
    for (const fn of [
      "mcp_preview_catalog_style_update",
      "mcp_apply_catalog_style_update",
      "mcp_preview_catalog_reference_upsert",
      "mcp_apply_catalog_reference_upsert",
      "mcp_preview_catalog_shotlist_upsert",
      "mcp_apply_catalog_shotlist_upsert",
    ]) {
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role`));
    }
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO (anon|authenticated)/);
    expect(sql).toContain("mcp_catalog_reference_keep_paths");
    expect(sql).toContain("changed_since_preview");
  });
});
