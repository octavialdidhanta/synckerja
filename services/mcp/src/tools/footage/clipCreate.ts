import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { FootageClipCreateInput, FootageClipCreatePreview, FootageClipCreateSaved } from "../../db/footage";
import {
  confirmFootageInput,
  FOOTAGE_CONFIRM_NEXT_STEP,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "./confirmation";

const seconds = z.number().finite().min(0).max(86400);

const newScene = z.object({
  start_seconds: seconds,
  end_seconds: seconds.nullable().optional(),
  scene_kind: z.string().trim().min(1).max(80),
  summary: z.string().trim().max(4000).optional(),
  note: z.string().trim().max(4000).optional(),
  hijab: z.boolean().optional(),
  watermark: z.boolean().optional(),
  meja_biru: z.boolean().optional(),
  lengkuas: z.boolean().optional(),
}).strict().refine((s) => s.end_seconds == null || s.end_seconds >= s.start_seconds);

/** A new clip and every scene in it. Scene numbers follow start order; starts must differ. */
export const clipCreatePreviewInput = z.object({
  file_key: z.string().trim().min(1).max(2000),
  media_type: z.enum(["video", "image"]),
  origin: z.string().trim().transform((v) => v.toLowerCase()).pipe(z.enum(["hp", "ai", "foto"])),
  location: z.string().trim().max(500).optional(),
  product: z.string().trim().max(500).optional(),
  summary: z.string().trim().max(4000).optional(),
  note: z.string().trim().max(4000).optional(),
  duration_seconds: seconds.nullable().optional(),
  storage_status: z.enum(["inbox", "bank"]).optional(),
  scenes: z.array(newScene).min(1).max(200),
}).strict()
  .refine((v) => new Set(v.scenes.map((s) => s.start_seconds)).size === v.scenes.length)
  .refine((v) =>
    v.duration_seconds == null
    || v.scenes.every((s) => s.start_seconds <= v.duration_seconds! && (s.end_seconds == null || s.end_seconds <= v.duration_seconds! + 0.05)),
  );

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

export function previewClipCreateResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: FootageClipCreateInput) => Promise<FootageClipCreatePreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = clipCreatePreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    const signed = await sign(ctx, "footage.clips.create", row.preview_id, row.expires_at);
    return {
      clip: row.clip,
      scenes: row.scenes,
      scene_count: row.scene_count,
      ...signed,
      next_step: FOOTAGE_CONFIRM_NEXT_STEP,
    };
  });
}

export function applyClipCreateResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<FootageClipCreateSaved>,
): Promise<FootageClipCreateSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "footage.clips.create", parsed.data.confirm_token).then((verified) => apply(ctx, verified.previewId));
}
