import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ThinkingClaim } from "../../db/claims";
import { claimCodes } from "./treeWrite";

export const thinkingClaimsSetInput = z
  .object({
    target: z.enum(["angle", "master"]),
    id: z.string().uuid(),
    claim_codes: claimCodes,
  })
  .strict();

type SetLinks = (
  ctx: McpAuthContext,
  input: { target: "angle" | "master"; target_id: string; codes: string[] },
) => Promise<{ claims: ThinkingClaim[]; unknown_codes: string[] }>;

export const THINKING_CLAIMS_HOW_TO_READ =
  "claims are the Daftar Klaim claims now backing this node. Only approved ones are proven: an Execution under a claim that is " +
  "needs_proof or rejected can be brainstormed but thinking.plan.save / thinking.plan.direct refuse it until an owner or admin " +
  "approves it in Office (Content Studio → Klaim). unknown_codes were not found: check catalog.claims.list.";

/** Replace the claims backing one Angle (its argument) or one Master Thought (a new belief). [] removes them all. */
export async function thinkingClaimsSetResult(ctx: McpAuthContext, args: unknown, set: SetLinks) {
  const parsed = thinkingClaimsSetInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  const out = await set(ctx, {
    target: parsed.data.target,
    target_id: parsed.data.id,
    codes: parsed.data.claim_codes.map((c) => c.toUpperCase()),
  });
  return { saved: true, ...out, how_to_read: THINKING_CLAIMS_HOW_TO_READ };
}

/** After thinking.angle.add or thinking.master.create: link the claim codes the caller sent with it. */
export async function linkClaimsAfterWrite<T extends { saved: boolean; id?: string }>(
  ctx: McpAuthContext,
  result: T,
  target: "angle" | "master",
  codes: string[] | undefined,
  set: SetLinks,
): Promise<T | (T & { claims: ThinkingClaim[]; unknown_codes: string[] })> {
  if (!codes?.length || !result.saved || !result.id) return result;
  try {
    const linked = await set(ctx, { target, target_id: result.id, codes: codes.map((c) => c.toUpperCase()) });
    return { ...result, ...linked };
  } catch {
    return { ...result, claims: [], unknown_codes: codes, claims_note: "Klaim tidak tertaut; coba lagi dengan thinking.claims.set." } as never;
  }
}

/** Claims an Execution inherits that block a plan: anything not approved. */
export function blockingClaims(claims: ThinkingClaim[]): ThinkingClaim[] {
  return claims.filter((c) => c.status !== "approved");
}
