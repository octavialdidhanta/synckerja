import { describe, expect, it } from "vitest";
import {
  applyFootageDelete,
  previewFootageDelete,
} from "../src/db/footage";
import { deleteFootagePreviewInput, previewDeleteFootageResult } from "../src/tools/footage/deleteClip";
import { deleteCatalogMediaPreviewInput } from "../src/tools/catalog/mediaDelete";
import {
  allowedCatalogStoragePath,
  catalogMediaRestorable,
  CATALOG_MEDIA_GRACE_SECONDS,
  pathsFromPurgeRow,
} from "../src/tools/catalog/mediaRetention";
import fs from "node:fs";

const ctx = { userId: "user-1", organizationId: "org-1" };
const previewId = "6b461c9c-dc68-4189-9383-fd548997e9b5";
const fileKey = "PIK2/sate/clip.mp4";
const org = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";

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

describe("catalog media delete", () => {
  it("rejects an extra field and a photo without an id", () => {
    expect(deleteFootagePreviewInput.safeParse({ file_key: fileKey }).success).toBe(true);
    expect(deleteFootagePreviewInput.safeParse({ file_key: fileKey, acknowledge_used: true }).success).toBe(true);
    expect(deleteFootagePreviewInput.safeParse({ file_key: fileKey, organization_id: org }).success).toBe(false);
    expect(deleteCatalogMediaPreviewInput.safeParse({
      kind: "menu_photo",
      id: "ad9f704d-0d1b-4a78-be44-ea272c7b6dc0",
    }).success).toBe(true);
    expect(deleteCatalogMediaPreviewInput.safeParse({ kind: "menu_photo" }).success).toBe(false);
    expect(deleteCatalogMediaPreviewInput.safeParse({
      kind: "reference_image",
      external_id: "r1",
      storage_path: `${org}/thumbs/references/r1/ref_r1.jpg`,
    }).success).toBe(true);
  });

  it("does not sign a used clip until the user has acknowledged it", async () => {
    const { admin, calls } = fakeAdmin({
      file_key: fileKey,
      media_type: "video",
      summary: "sate",
      scene_count: 2,
      storage_files: [{ kind: "scene_thumb", path: `${org}/thumbs/scene.jpg` }],
      used: true,
      usage_count: 1,
      usages: [{ external_ref: "plan-1" }],
      can_save: false,
      storage_kept: true,
    });
    let signed = false;
    const result = await previewDeleteFootageResult(
      ctx as never,
      { file_key: fileKey },
      (identity, input) => previewFootageDelete(admin, identity, input),
      async () => {
        signed = true;
        throw new Error("should not sign");
      },
    );
    expect(signed).toBe(false);
    expect(calls[0].fn).toBe("mcp_preview_footage_delete");
    expect(calls[0].args.p_organization_id).toBe("org-1");
    expect(result.can_save).toBe(false);
    expect(result).not.toHaveProperty("confirm_token");
    expect(result.storage_kept).toBe(true);
    expect(String(result.next_step)).toContain("acknowledge_used");
  });

  it("signs one delete after the uses are acknowledged", async () => {
    const { admin } = fakeAdmin({
      file_key: fileKey,
      scene_count: 2,
      storage_files: [],
      used: true,
      usage_count: 1,
      usages: [],
      can_save: true,
      preview_id: previewId,
      expires_at: "2026-11-22T12:15:00.000Z",
    });
    const result = await previewDeleteFootageResult(
      ctx as never,
      { file_key: fileKey, acknowledge_used: true },
      (identity, input) => previewFootageDelete(admin, identity, input),
      async () => ({ confirm_token: "signed-token-value-123456", expires_at: "2026-11-22T12:15:00.000Z" }),
    );
    expect(result.confirm_token).toBe("signed-token-value-123456");
    expect(result).not.toHaveProperty("preview_id");
    const saved = await applyFootageDelete(admin, ctx, previewId);
    expect(saved).toBeDefined();
  });

  it("keeps a clip restorable until the 30 day mark and only allows catalog storage paths", () => {
    const now = new Date("2026-11-22T15:00:00.000Z");
    expect(catalogMediaRestorable("2026-11-22T15:00:00.000Z", now)).toBe(true);
    expect(catalogMediaRestorable("2026-10-23T15:00:00.001Z", now)).toBe(true);
    expect(catalogMediaRestorable("2026-10-23T15:00:00.000Z", now)).toBe(false);
    expect(allowedCatalogStoragePath(`${org}/previews/${previewId}.mp4`)).toBe(true);
    expect(allowedCatalogStoragePath(`${org}/thumbs/${previewId}.jpg`)).toBe(true);
    expect(allowedCatalogStoragePath(`${org}/photos/${previewId}.png`)).toBe(true);
    expect(allowedCatalogStoragePath(`${org}/thumbs/references/r1/ref_r1.jpg`)).toBe(true);
    expect(allowedCatalogStoragePath(`${org}/previews/${previewId}.mov`)).toBe(false);
    expect(allowedCatalogStoragePath(`${org}/../secret.mp4`)).toBe(false);
    expect(pathsFromPurgeRow({
      paths: ["plain.jpg", { kind: "preview", path: `${org}/previews/${previewId}.mp4` }],
    })).toEqual(["plain.jpg", `${org}/previews/${previewId}.mp4`]);
    expect(CATALOG_MEDIA_GRACE_SECONDS).toBe(2_592_000);
    const script = fs.readFileSync(new URL("../../../scripts/catalog-bank/media-retention.mjs", import.meta.url), "utf8");
    expect(script).toContain("CATALOG_MEDIA_GRACE_SECONDS = 2_592_000");
    expect(script).toContain("previews/");
    expect(script).toContain("\\.mp4");
  });
});

describe("catalog media schemas published to MCP", () => {
  it("are flat objects the MCP SDK can list, still checked per kind", async () => {
    const { publishedToolShape } = await import("../src/mcp/handler");
    const { restoreCatalogMediaPreviewInput } = await import("../src/tools/catalog/mediaDelete");
    expect(Object.keys(publishedToolShape(deleteCatalogMediaPreviewInput))).toContain("kind");
    expect(Object.keys(publishedToolShape(restoreCatalogMediaPreviewInput))).toContain("storage_path");
    expect(restoreCatalogMediaPreviewInput.safeParse({
      kind: "menu_photo",
      id: "ad9f704d-0d1b-4a78-be44-ea272c7b6dc0",
      storage_path: "x",
    }).success).toBe(false);
    expect(restoreCatalogMediaPreviewInput.safeParse({ kind: "reference_image", external_id: "r1" }).success).toBe(false);
  });
});
