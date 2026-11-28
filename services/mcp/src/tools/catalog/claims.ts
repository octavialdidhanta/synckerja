import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type {
  ClaimApproveInput,
  ClaimApproveSaved,
  ClaimList,
  ClaimListFilter,
  ClaimUpsertInput,
  ClaimUpsertPreview,
  ClaimUpsertSaved,
} from "../../db/claims";
import {
  confirmFootageInput,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "../footage/confirmation";

const slug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const claimCode = z.string().trim().regex(/^[Kk][Ll]\d{2,4}$/);
const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listClaimsInput = z
  .object({
    status: z.enum(["needs_proof", "approved", "rejected"]).optional(),
    product: slug.optional(),
    location: slug.optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

const scopeInput = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("brand") }).strict(),
  z.object({ scope: z.literal("product"), product: slug }).strict(),
  z.object({ scope: z.literal("location"), location: slug }).strict(),
]);

export const claimUpsertPreviewInput = z
  .object({
    code: claimCode.optional(),
    text: z.string().trim().min(3).max(500).optional(),
    proof: z.string().trim().max(2000).nullable().optional(),
    valid_until: isoDate.nullable().optional(),
    scopes: z.array(scopeInput).min(1).max(50).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.code || value.text), { message: "text is required for a new claim" })
  .refine((value) => !value.code || Object.keys(value).length > 1, { message: "nothing to change" });

export const claimApproveInput = z
  .object({
    code: claimCode,
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

const UPSERT_NEXT_STEP =
  "Nothing is saved yet. Show the claim before and after: sentence, proof, valid_until and where it applies. "
  + "A claim saved from here always waits as needs_proof until an owner or admin approves it. "
  + "Call catalog.claims.upsert with this confirm_token only after the user clearly says yes.";

type Sign = (
  ctx: McpAuthContext,
  tool: FootageConfirmableTool,
  previewId: string,
  expiresAt: string,
) => Promise<SignedFootageConfirmation>;

type Verify = (ctx: McpAuthContext, tool: FootageConfirmableTool, token: string) => Promise<VerifiedFootageConfirmation>;

export function listClaimsResult(
  ctx: McpAuthContext,
  args: unknown,
  list: (ctx: McpAuthContext, filter: ClaimListFilter) => Promise<ClaimList>,
): Promise<ClaimList> {
  const parsed = listClaimsInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return list(ctx, parsed.data);
}

export async function previewClaimUpsertResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: ClaimUpsertInput) => Promise<ClaimUpsertPreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = claimUpsertPreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  const input: ClaimUpsertInput = { ...parsed.data, code: parsed.data.code?.toUpperCase() };
  if (!input.code) delete input.code;
  const row = await preview(ctx, input);
  if (!row.preview_id || !row.expires_at) throw new Error("preview_failed");
  const token = await sign(ctx, "catalog.claims.upsert", row.preview_id, row.expires_at);
  const { preview_id: _p, expires_at: _e, ...summary } = row;
  return { ...summary, ...token, next_step: UPSERT_NEXT_STEP };
}

export async function applyClaimUpsertResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<ClaimUpsertSaved>,
): Promise<ClaimUpsertSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  const verified = await verify(ctx, "catalog.claims.upsert", parsed.data.confirm_token);
  return apply(ctx, verified.previewId);
}

export function approveClaimResult(
  ctx: McpAuthContext,
  args: unknown,
  approve: (ctx: McpAuthContext, input: ClaimApproveInput) => Promise<ClaimApproveSaved>,
): Promise<ClaimApproveSaved> {
  const parsed = claimApproveInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return approve(ctx, { ...parsed.data, code: parsed.data.code.toUpperCase() });
}
