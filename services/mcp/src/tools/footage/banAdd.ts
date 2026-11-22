import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { FootageBanInput, FootageBanPreview, FootageBanSaved } from "../../db/footage";
import {
  confirmFootageInput,
  FOOTAGE_CONFIRM_NEXT_STEP,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "./confirmation";

export const banAddPreviewInput = z.object({
  file_key: z.string().trim().min(1).max(2000),
  scene_index: z.number().int().min(1).max(100000),
  reason: z.string().trim().min(1).max(2000),
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

export function previewBanAddResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: FootageBanInput) => Promise<FootageBanPreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = banAddPreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    const signed = await sign(ctx, "footage.ban.add", row.preview_id, row.expires_at);
    return {
      file_key: row.file_key,
      scene_index: row.scene_index,
      before_reason: row.before_reason,
      after_reason: row.after_reason,
      ...signed,
      next_step: FOOTAGE_CONFIRM_NEXT_STEP,
    };
  });
}

export function applyBanAddResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<FootageBanSaved>,
): Promise<FootageBanSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "footage.ban.add", parsed.data.confirm_token).then((verified) =>
    apply(ctx, verified.previewId),
  );
}
