import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type {
  FootageSceneBatchInput,
  FootageSceneBatchPreview,
  FootageSceneBatchSaved,
} from "../../db/footage";
import {
  confirmFootageInput,
  FOOTAGE_CONFIRM_NEXT_STEP,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "./confirmation";

const scenePatch = z.object({
  scene_index: z.number().int().min(1).max(100000),
  scene_kind: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().max(4000).optional(),
  note: z.string().trim().max(4000).optional(),
  hijab: z.boolean().optional(),
  watermark: z.boolean().optional(),
  meja_biru: z.boolean().optional(),
  lengkuas: z.boolean().optional(),
  tags: z.record(z.union([z.boolean(), z.string().trim().min(1).max(200)])).optional(),
}).strict().refine((scene) =>
  scene.scene_kind !== undefined
  || scene.summary !== undefined
  || scene.note !== undefined
  || scene.hijab !== undefined
  || scene.watermark !== undefined
  || scene.meja_biru !== undefined
  || scene.lengkuas !== undefined
  || (scene.tags !== undefined && Object.keys(scene.tags).length > 0)
);

export const upsertSceneBatchPreviewInput = z.object({
  file_key: z.string().trim().min(1).max(2000),
  scenes: z.array(scenePatch).min(1).max(50),
}).strict().refine((value) => new Set(value.scenes.map((scene) => scene.scene_index)).size === value.scenes.length);

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

export function previewSceneBatchResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: FootageSceneBatchInput) => Promise<FootageSceneBatchPreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = upsertSceneBatchPreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    const signed = await sign(ctx, "footage.scenes.upsert_batch", row.preview_id, row.expires_at);
    return {
      file_key: row.file_key,
      changes: row.changes,
      ...signed,
      next_step: FOOTAGE_CONFIRM_NEXT_STEP,
    };
  });
}

export function applySceneBatchResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<FootageSceneBatchSaved>,
): Promise<FootageSceneBatchSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "footage.scenes.upsert_batch", parsed.data.confirm_token).then((verified) =>
    apply(ctx, verified.previewId),
  );
}
