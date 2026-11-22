import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type {
  FootageDeleteInput,
  FootageDeletePreview,
  FootageDeleteSaved,
  FootageRestoreInput,
  FootageRestorePreview,
  FootageRestoreSaved,
} from "../../db/footage";
import {
  confirmFootageInput,
  FOOTAGE_CONFIRM_NEXT_STEP,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "./confirmation";

export const deleteFootagePreviewInput = z.object({
  file_key: z.string().trim().min(1).max(2000),
  acknowledge_used: z.boolean().optional(),
}).strict();

export const restoreFootagePreviewInput = z.object({
  file_key: z.string().trim().min(1).max(2000),
}).strict();

const DELETE_USED_NEXT_STEP =
  "This clip has been used in content. Show the clip, the scene count, every storage file, and the uses. Nothing is saved. "
  + "Call footage.delete.preview again with acknowledge_used true only after the user confirms they still want this clip hidden. "
  + "The storage files stay for 30 days either way.";

const DELETE_NEXT_STEP =
  "Nothing is saved yet. Show the clip, the scene count, the storage files, and any uses. "
  + "Saying yes hides the clip for 30 days. The storage files and the laptop file stay. "
  + "Call footage.delete with this confirm_token only after the user clearly says yes to this one delete.";

const RESTORE_EXPIRED_NEXT_STEP =
  "The 30 day restore window has ended. Nothing was saved. Do not call footage.restore.";

type Sign = (
  ctx: McpAuthContext,
  tool: FootageConfirmableTool,
  previewId: string,
  expiresAt: string,
) => Promise<SignedFootageConfirmation>;

type Verify = (
  ctx: McpAuthContext,
  tool: FootageConfirmableTool,
  token: string,
) => Promise<VerifiedFootageConfirmation>;

export function previewDeleteFootageResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: FootageDeleteInput) => Promise<FootageDeletePreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = deleteFootagePreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    const summary = {
      file_key: row.file_key,
      media_type: row.media_type ?? null,
      summary: row.summary ?? null,
      scene_count: row.scene_count,
      storage_files: row.storage_files ?? [],
      used: row.used === true,
      usage_count: row.usage_count ?? 0,
      usages: row.usages ?? [],
      storage_kept: true,
      can_save: row.can_save === true,
    };
    if (summary.can_save !== true || !row.preview_id || !row.expires_at) {
      return { ...summary, can_save: false, next_step: DELETE_USED_NEXT_STEP };
    }
    const signed = await sign(ctx, "footage.delete", row.preview_id, row.expires_at);
    return { ...summary, ...signed, next_step: DELETE_NEXT_STEP };
  });
}

export function applyDeleteFootageResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<FootageDeleteSaved>,
): Promise<FootageDeleteSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "footage.delete", parsed.data.confirm_token).then((verified) =>
    apply(ctx, verified.previewId),
  );
}

export function previewRestoreFootageResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: FootageRestoreInput) => Promise<FootageRestorePreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = restoreFootagePreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    const summary = {
      file_key: row.file_key,
      deleted_at: row.deleted_at,
      purge_after: row.purge_after ?? null,
      scene_count: row.scene_count,
      can_save: row.can_save === true,
    };
    if (summary.can_save !== true || !row.preview_id || !row.expires_at) {
      return { ...summary, can_save: false, reason: row.reason ?? "restore_expired", next_step: RESTORE_EXPIRED_NEXT_STEP };
    }
    const signed = await sign(ctx, "footage.restore", row.preview_id, row.expires_at);
    return { ...summary, ...signed, next_step: FOOTAGE_CONFIRM_NEXT_STEP };
  });
}

export function applyRestoreFootageResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<FootageRestoreSaved>,
): Promise<FootageRestoreSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "footage.restore", parsed.data.confirm_token).then((verified) =>
    apply(ctx, verified.previewId),
  );
}
