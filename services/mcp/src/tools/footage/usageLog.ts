import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { FootageUsageInput, FootageUsagePreview, FootageUsageSaved } from "../../db/footage";
import {
  confirmFootageInput,
  FOOTAGE_ALREADY_LOGGED_NEXT_STEP,
  FOOTAGE_CONFIRM_NEXT_STEP,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "./confirmation";

export const usageLogPreviewInput = z.object({
  file_key: z.string().trim().min(1).max(2000),
  external_ref: z.string().trim().min(1).max(200),
  in_seconds: z.number().min(0).max(1_000_000),
  out_seconds: z.number().min(0).max(1_000_000),
  title: z.string().trim().max(500).optional(),
}).strict().refine((value) => value.out_seconds >= value.in_seconds);

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

export function previewUsageLogResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: FootageUsageInput) => Promise<FootageUsagePreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = usageLogPreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    if (row.can_save !== true || !row.preview_id || !row.expires_at) {
      return {
        file_key: row.file_key,
        external_ref: row.external_ref,
        in_seconds: row.in_seconds,
        out_seconds: row.out_seconds,
        title: row.title ?? null,
        already_logged: true,
        can_save: false,
        next_step: FOOTAGE_ALREADY_LOGGED_NEXT_STEP,
      };
    }
    const signed = await sign(ctx, "footage.usage.log", row.preview_id, row.expires_at);
    return {
      file_key: row.file_key,
      external_ref: row.external_ref,
      in_seconds: row.in_seconds,
      out_seconds: row.out_seconds,
      title: row.title ?? null,
      already_logged: false,
      can_save: true,
      ...signed,
      next_step: FOOTAGE_CONFIRM_NEXT_STEP,
    };
  });
}

export function applyUsageLogResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<FootageUsageSaved>,
): Promise<FootageUsageSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "footage.usage.log", parsed.data.confirm_token).then((verified) =>
    apply(ctx, verified.previewId),
  );
}
