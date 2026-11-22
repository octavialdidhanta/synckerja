import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { FootageMoveInput, FootageMovePreview, FootageMoveSaved } from "../../db/footage";
import {
  confirmFootageInput,
  FOOTAGE_CONFIRM_NEXT_STEP,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "./confirmation";

export const moveFootagePreviewInput = z.object({
  file_key: z.string().trim().min(1).max(2000),
  new_file_key: z.string().trim().min(1).max(2000),
  location: z.string().trim().max(500).optional(),
  product: z.string().trim().max(500).optional(),
}).strict();

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

export function previewMoveFootageResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: FootageMoveInput) => Promise<FootageMovePreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = moveFootagePreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    const signed = await sign(ctx, "footage.move", row.preview_id, row.expires_at);
    return {
      file_key: row.file_key,
      new_file_key: row.new_file_key,
      before: row.before,
      after: row.after,
      ...signed,
      next_step: FOOTAGE_CONFIRM_NEXT_STEP,
    };
  });
}

export function applyMoveFootageResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<FootageMoveSaved>,
): Promise<FootageMoveSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "footage.move", parsed.data.confirm_token).then((verified) =>
    apply(ctx, verified.previewId),
  );
}
