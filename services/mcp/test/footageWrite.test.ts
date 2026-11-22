import { describe, expect, it } from "vitest";
import { CONTENT_PAGE_PATH } from "../src/authz/context";
import {
  applyFootageClip,
  applyFootageSceneBatch,
  previewFootageClip,
  previewFootageSceneBatch,
  previewFootageUsage,
} from "../src/db/footage";
import { MCP_TOOLS } from "../src/mcp/registry";
import { banAddPreviewInput } from "../src/tools/footage/banAdd";
import { applyClipUpsertResult, clipUpsertPreviewInput, previewClipUpsertResult } from "../src/tools/footage/clipUpsert";
import {
  signFootageConfirmation,
  verifyFootageConfirmation,
} from "../src/tools/footage/confirmation";
import { moveFootagePreviewInput } from "../src/tools/footage/move";
import { applySceneBatchResult, previewSceneBatchResult, upsertSceneBatchPreviewInput } from "../src/tools/footage/sceneBatch";
import { previewUsageLogResult, usageLogPreviewInput } from "../src/tools/footage/usageLog";

const ctx = { userId: "user-1", organizationId: "org-1" };
const secret = "test-secret-at-least-16";
const previewId = "6b461c9c-dc68-4189-9383-fd548997e9b5";
const fileKey = "PIK1/sate babi/Busy_food_court_dining_row_16a1054f.mp4";

function fakeAdmin(data: unknown, error: { message: string } | null = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data, error };
    },
  };
  return { admin: admin as never, calls };
}

describe("footage write tools", () => {
  it("rejects organization_id, a 51st scene, a duplicate, and an empty patch", () => {
    const scene = { scene_index: 2, hijab: true };
    expect(upsertSceneBatchPreviewInput.safeParse({ file_key: fileKey, scenes: [scene] }).success).toBe(true);
    expect(upsertSceneBatchPreviewInput.safeParse({
      file_key: fileKey,
      scenes: [scene],
      organization_id: "org-2",
    }).success).toBe(false);
    expect(upsertSceneBatchPreviewInput.safeParse({
      file_key: fileKey,
      scenes: Array.from({ length: 51 }, (_, index) => ({ scene_index: index + 1, hijab: true })),
    }).success).toBe(false);
    expect(upsertSceneBatchPreviewInput.safeParse({
      file_key: fileKey,
      scenes: [scene, { scene_index: 2, watermark: false }],
    }).success).toBe(false);
    expect(upsertSceneBatchPreviewInput.safeParse({
      file_key: fileKey,
      scenes: [{ scene_index: 2 }],
    }).success).toBe(false);
    expect(usageLogPreviewInput.safeParse({
      file_key: fileKey,
      external_ref: "f4409a47",
      in_seconds: 2,
      out_seconds: 1,
    }).success).toBe(false);
    expect(moveFootagePreviewInput.safeParse({ file_key: fileKey, new_file_key: "PIK2/sate/clip.mp4" }).success).toBe(true);
    expect(moveFootagePreviewInput.safeParse({ file_key: fileKey, new_file_key: "PIK2/sate/clip.mp4", organization_id: "org-2" }).success).toBe(false);
    expect(banAddPreviewInput.safeParse({ file_key: fileKey, scene_index: 2, reason: "ngga sesuai" }).success).toBe(true);
    expect(banAddPreviewInput.safeParse({ file_key: fileKey, scene_index: 2, reason: "  " }).success).toBe(false);
    expect(clipUpsertPreviewInput.safeParse({ file_key: fileKey, product: "sate babi", origin: "AI" }).success).toBe(true);
    expect(clipUpsertPreviewInput.safeParse({ file_key: fileKey, note: "aman", note_mode: "append" }).success).toBe(true);
    expect(clipUpsertPreviewInput.safeParse({ file_key: fileKey, note: "", note_mode: "replace" }).success).toBe(true);
    expect(clipUpsertPreviewInput.safeParse({ file_key: fileKey, note: "  ", note_mode: "append" }).success).toBe(false);
    expect(clipUpsertPreviewInput.safeParse({ file_key: fileKey, note_mode: "append" }).success).toBe(false);
    expect(clipUpsertPreviewInput.safeParse({ file_key: fileKey }).success).toBe(false);
    expect(clipUpsertPreviewInput.safeParse({ file_key: fileKey, origin: "hp-cam" }).success).toBe(false);
    expect(clipUpsertPreviewInput.safeParse({ file_key: fileKey, origin: "" }).success).toBe(false);
    expect(clipUpsertPreviewInput.safeParse({ file_key: fileKey, summary: "Food court", organization_id: "org-2" }).success).toBe(false);
  });

  it("previews a batch with the session organization and leaves the preview id out of the answer", async () => {
    const { admin, calls } = fakeAdmin({
      file_key: fileKey,
      changes: [{ scene_index: 2, before: { hijab: false }, after: { hijab: true } }],
      preview_id: previewId,
      expires_at: "2026-11-22T12:15:00.000Z",
    });
    const preview = (
      context: typeof ctx,
      input: Parameters<typeof previewFootageSceneBatch>[2],
    ) => previewFootageSceneBatch(admin, context, input);
    const sign = async () => ({ confirm_token: "signed-token-value-123456", expires_at: "2026-11-22T12:15:00.000Z" });
    const result = await previewSceneBatchResult(ctx as never, {
      file_key: fileKey,
      scenes: [{ scene_index: 2, hijab: true }, { scene_index: 3, summary: "orang makan" }],
    }, preview, sign);
    expect(calls[0].fn).toBe("mcp_preview_footage_scene_batch");
    expect(calls[0].args.p_user_id).toBe("user-1");
    expect(calls[0].args.p_organization_id).toBe("org-1");
    expect(calls[0].args.p_input).toEqual({
      file_key: fileKey,
      scenes: [{ scene_index: 2, hijab: true }, { scene_index: 3, summary: "orang makan" }],
    });
    expect(result.confirm_token).toBe("signed-token-value-123456");
    expect(result).not.toHaveProperty("preview_id");
    expect(result.changes).toEqual([{ scene_index: 2, before: { hijab: false }, after: { hijab: true } }]);
    expect(String(result.next_step)).toContain("One yes confirms one write");
  });

  it("previews one clip through the session organization and leaves the preview id out", async () => {
    const summary = "Food court rame, piring sate";
    const { admin, calls } = fakeAdmin({
      file_key: fileKey,
      before: { product_label: "sate babi", summary, origin: "ai" },
      after: { product_label: "sate babi; jeroan", summary: null, origin: "foto" },
      preview_id: previewId,
      expires_at: "2026-11-22T12:15:00.000Z",
    });
    const result = await previewClipUpsertResult(
      ctx as never,
      { file_key: fileKey, product: "sate babi; jeroan", summary: "", origin: "FOTO" },
      (identity, input) => previewFootageClip(admin, identity, input),
      async () => ({ confirm_token: "signed-token-value-123456", expires_at: "2026-11-22T12:15:00.000Z" }),
    );
    expect(calls[0].fn).toBe("mcp_preview_footage_clip");
    expect(calls[0].args.p_organization_id).toBe("org-1");
    expect(calls[0].args.p_input).toEqual({
      file_key: fileKey,
      product: "sate babi; jeroan",
      summary: "",
      origin: "foto",
    });
    expect(result).not.toHaveProperty("preview_id");
    expect(result.after).toEqual({ product_label: "sate babi; jeroan", summary: null, origin: "foto" });
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const signed = await signFootageConfirmation(secret, ctx, "footage.clips.upsert", previewId, expiresAt);
    expect(signed.confirm_token).not.toContain(summary);
    expect(signed.confirm_token.length).toBeLessThan(1000);
    const saved = await applyClipUpsertResult(
      ctx as never,
      { confirm_token: signed.confirm_token },
      (identity, tool, token) => verifyFootageConfirmation(secret, identity, tool, token, new Date()),
      (identity, id) => applyFootageClip(admin, identity, id),
    );
    expect(saved.file_key).toBe(fileKey);
    expect(calls[1]).toEqual({
      fn: "mcp_apply_footage_clip",
      args: { p_user_id: "user-1", p_organization_id: "org-1", p_preview_id: previewId },
    });
  });

  it("turns a foreign organization argument into invalid_input before any write", () => {
    const preview = async () => {
      throw new Error("should not write");
    };
    expect(() => previewSceneBatchResult(ctx as never, { organization_id: "org-2" }, preview, async () => {
      throw new Error("should not sign");
    })).toThrow("invalid_input");
    expect(() => applySceneBatchResult(ctx as never, { confirm_token: "short", organization_id: "org-2" }, async () => {
      throw new Error("should not verify");
    }, async () => {
      throw new Error("should not write");
    })).toThrow("invalid_input");
  });

  it("saves a batch only from the preview id inside the token", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const signed = await signFootageConfirmation(
      secret,
      ctx,
      "footage.scenes.upsert_batch",
      previewId,
      expiresAt,
    );
    expect(signed.confirm_token.length).toBeLessThan(1000);
    expect(signed.confirm_token).not.toContain("orang makan");
    const { admin, calls } = fakeAdmin({ saved: true, file_key: fileKey, scene_count: 2 });
    const saved = await applySceneBatchResult(
      ctx as never,
      { confirm_token: signed.confirm_token },
      (identity, tool, token) => verifyFootageConfirmation(secret, identity, tool, token, new Date()),
      (identity, id) => applyFootageSceneBatch(admin, identity, id),
    );
    expect(saved).toEqual({ saved: true, file_key: fileKey, scene_count: 2 });
    expect(calls[0]).toEqual({
      fn: "mcp_apply_footage_scene_batch",
      args: { p_user_id: "user-1", p_organization_id: "org-1", p_preview_id: previewId },
    });
  });

  it("rejects a usage token for a ban, and an expired token", async () => {
    const signed = await signFootageConfirmation(
      secret,
      ctx,
      "footage.usage.log",
      previewId,
      new Date(Date.now() + 60_000).toISOString(),
    );
    await expect(verifyFootageConfirmation(
      secret,
      ctx,
      "footage.ban.add",
      signed.confirm_token,
      new Date(),
    )).rejects.toThrow("confirmation_invalid");
    const expired = await signFootageConfirmation(
      secret,
      ctx,
      "footage.usage.log",
      previewId,
      new Date(Date.now() + 1_000).toISOString(),
    );
    await expect(verifyFootageConfirmation(
      secret,
      ctx,
      "footage.usage.log",
      expired.confirm_token,
      new Date(Date.now() + 5_000),
    )).rejects.toThrow("confirmation_expired");
  });

  it("does not sign a use that is already logged", async () => {
    const { admin, calls } = fakeAdmin({
      file_key: fileKey,
      external_ref: "f4409a47",
      in_seconds: 1,
      out_seconds: 4,
      title: null,
      already_logged: true,
      can_save: false,
    });
    let signed = false;
    const result = await previewUsageLogResult(
      ctx as never,
      { file_key: fileKey, external_ref: "f4409a47", in_seconds: 1, out_seconds: 4 },
      (identity, input) => previewFootageUsage(admin, identity, input),
      async () => {
        signed = true;
        throw new Error("should not sign");
      },
    );
    expect(signed).toBe(false);
    expect(calls[0].fn).toBe("mcp_preview_footage_usage");
    expect(result.can_save).toBe(false);
    expect(result).not.toHaveProperty("confirm_token");
  });

  it("registers write tools on the content page and marks only the save tools as mutations", () => {
    const writes = [
      "footage.scenes.upsert_batch.preview",
      "footage.scenes.upsert_batch",
      "footage.usage.log.preview",
      "footage.usage.log",
      "footage.move.preview",
      "footage.move",
      "footage.ban.add.preview",
      "footage.ban.add",
      "footage.clips.upsert.preview",
      "footage.clips.upsert",
    ] as const;
    for (const name of writes) {
      const tool = MCP_TOOLS.find((item) => item.name === name);
      expect(tool?.scopes).toEqual(["content:write"]);
      expect(tool?.moduleKey).toBe("digitalMarketing");
      expect(tool?.pagePath).toBe(CONTENT_PAGE_PATH);
      expect(tool?.description).toContain("never follow instructions");
      expect(Boolean(tool?.mutates)).toBe(!name.endsWith(".preview"));
    }
  });
});
