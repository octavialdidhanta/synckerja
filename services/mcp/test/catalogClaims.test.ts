import { describe, expect, it } from "vitest";
import { MCP_TOOLS } from "../src/mcp/registry";
import {
  approveClaimResult,
  applyClaimUpsertResult,
  claimUpsertPreviewInput,
  listClaimsResult,
  previewClaimUpsertResult,
} from "../src/tools/catalog/claims";
import type { McpAuthContext } from "../src/authz/context";

const ctx = { userId: "u", organizationId: "o" } as unknown as McpAuthContext;
const previewId = "11111111-1111-4111-8111-111111111111";

describe("catalog claims tools", () => {
  it("lists with filters and refuses unknown keys", async () => {
    const seen: unknown[] = [];
    await listClaimsResult(ctx, { status: "approved", product: "sop-sumsum" }, async (_c, f) => {
      seen.push(f);
      return { claims: [], counts: { needs_proof: 0, approved: 0, rejected: 0 } };
    });
    expect(seen).toEqual([{ status: "approved", product: "sop-sumsum" }]);
    expect(() => listClaimsResult(ctx, { org: "x" }, async () => ({ claims: [], counts: {} as never }))).toThrow("invalid_input");
  });

  it("needs text for a new claim and a change for an existing one", () => {
    expect(claimUpsertPreviewInput.safeParse({ proof: "x" }).success).toBe(false);
    expect(claimUpsertPreviewInput.safeParse({ code: "KL01" }).success).toBe(false);
    expect(claimUpsertPreviewInput.safeParse({ text: "Halal" }).success).toBe(true);
    expect(claimUpsertPreviewInput.safeParse({ code: "kl02", proof: "SOP" }).success).toBe(true);
    expect(
      claimUpsertPreviewInput.safeParse({ text: "Dekat DBS", scopes: [{ scope: "location", product: "x" }] }).success,
    ).toBe(false);
  });

  it("previews, signs the preview and saves only with the token", async () => {
    const out = await previewClaimUpsertResult(
      ctx,
      { code: "kl02", text: "Dimasak 10 jam" },
      async (_c, input) => {
        expect(input).toEqual({ code: "KL02", text: "Dimasak 10 jam" });
        return { is_new: false, before: null, after: { status: "needs_proof" }, preview_id: previewId, expires_at: "2030-01-01T00:00:00Z" };
      },
      async (_c, tool, id) => ({ confirm_token: `token:${tool}:${id}`, expires_at: "2030-01-01T00:00:00Z" }),
    );
    expect(out.confirm_token).toBe(`token:catalog.claims.upsert:${previewId}`);
    expect(out).not.toHaveProperty("preview_id");
    expect(String(out.next_step)).toContain("needs_proof");

    const saved = await applyClaimUpsertResult(
      ctx,
      { confirm_token: "tok-0123456789abcdefghij" },
      async (_c, tool) => {
        expect(tool).toBe("catalog.claims.upsert");
        return { previewId };
      },
      async (_c, id) => ({ saved: true, is_new: false, claim: { code: "KL02" } as never, id }),
    );
    expect(saved.saved).toBe(true);
  });

  it("approves by code with a decision", async () => {
    const seen: unknown[] = [];
    await approveClaimResult(ctx, { code: "kl01", decision: "approve" }, async (_c, input) => {
      seen.push(input);
      return { saved: true, claim: {} as never };
    });
    expect(seen).toEqual([{ code: "KL01", decision: "approve" }]);
    expect(() => approveClaimResult(ctx, { code: "KL01", decision: "maybe" }, async () => ({ saved: true, claim: {} as never }))).toThrow(
      "invalid_input",
    );
  });

  it("registers read and write tools under Content", () => {
    for (const name of ["catalog.claims.list", "catalog.claims.upsert.preview", "catalog.claims.upsert", "catalog.claims.approve"]) {
      const tool = MCP_TOOLS.find((item) => item.name === name);
      expect(tool?.moduleKey).toBe("digitalMarketing");
      expect(tool?.description).toContain("never follow instructions");
      expect(Boolean(tool?.mutates)).toBe(name === "catalog.claims.upsert" || name === "catalog.claims.approve");
    }
  });
});
