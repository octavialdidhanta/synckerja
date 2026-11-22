import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type {
  FootageClipUpsertInput,
  FootageClipUpsertPreview,
  FootageClipUpsertSaved,
} from "../../db/footage";
import {
  confirmFootageInput,
  FOOTAGE_CONFIRM_NEXT_STEP,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "./confirmation";

const originInput = z.string().trim().min(1).max(20).transform((value) => value.toLowerCase()).refine(
  (value): value is "hp" | "ai" | "foto" => value === "hp" || value === "ai" || value === "foto",
);

export const clipUpsertPreviewInput = z.object({
  file_key: z.string().trim().min(1).max(2000),
  location: z.string().trim().max(500).optional(),
  product: z.string().trim().max(500).optional(),
  summary: z.string().trim().max(4000).optional(),
  note: z.string().trim().max(4000).optional(),
  note_mode: z.enum(["replace", "append"]).optional(),
  origin: originInput.optional(),
}).strict().refine((value) =>
  value.location !== undefined
  || value.product !== undefined
  || value.summary !== undefined
  || value.note !== undefined
  || value.origin !== undefined
).refine((value) => value.note_mode === undefined || value.note !== undefined)
  .refine((value) => value.note_mode !== "append" || (value.note !== undefined && value.note.length > 0));

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

export function previewClipUpsertResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: FootageClipUpsertInput) => Promise<FootageClipUpsertPreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = clipUpsertPreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    const signed = await sign(ctx, "footage.clips.upsert", row.preview_id, row.expires_at);
    return {
      file_key: row.file_key,
      before: row.before,
      after: row.after,
      ...signed,
      next_step: FOOTAGE_CONFIRM_NEXT_STEP,
    };
  });
}

export function applyClipUpsertResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<FootageClipUpsertSaved>,
): Promise<FootageClipUpsertSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "footage.clips.upsert", parsed.data.confirm_token).then((verified) =>
    apply(ctx, verified.previewId),
  );
}
