/**
 * Thinking Lab ↔ Daftar Klaim. Claims back an Angle (its argument) and optionally a Master Thought (a new belief).
 * Links are product_claim_uses rows (module thinking_lab, ref "angle:<id>" / "master:<id>"). An Execution inherits
 * both; it may be brainstormed on any claim but becomes a brief only when all of them are approved.
 */
import type { Claim } from "@/6-1-content-studio/claims/claimsData";
import { isClaimExpired } from "@/6-1-content-studio/claims/claimsData";

export const THINKING_USE_MODULE = "thinking_lab";

export type ThinkingClaimTarget = "angle" | "master";

export function thinkingRef(target: ThinkingClaimTarget, id: string): string {
  return `${target}:${id}`;
}

export function linkedClaims(claims: Claim[], refs: string[]): Claim[] {
  return claims.filter((c) => c.uses.some((u) => u.module === THINKING_USE_MODULE && refs.includes(u.ref_id)));
}

/** Claims that stop an Execution from becoming a brief: anything not approved or past its date. */
export function claimsBlockingBrief(claims: Claim[], today?: string): Claim[] {
  return claims.filter((c) => c.status !== "approved" || isClaimExpired(c, today));
}

/**
 * Claims to offer for a node: brand-wide claims and claims on products of the Master Thought's sub-categories first,
 * then the rest. Rejected claims are never offered.
 */
export function rankClaimsForNode(
  claims: Claim[],
  menuSubService: Map<string, string | null>,
  subServiceIds: string[],
  q = "",
): Claim[] {
  const query = q.trim().toLowerCase();
  const fits = (c: Claim) =>
    c.scopes.some(
      (s) =>
        s.scope === "brand" ||
        (s.scope === "product" && subServiceIds.includes(menuSubService.get(s.targetId ?? "") ?? "")),
    );
  return claims
    .filter((c) => c.status !== "rejected")
    .filter((c) => !query || c.text.toLowerCase().includes(query) || c.code.toLowerCase().includes(query))
    .map((c) => ({ c, rank: (fits(c) ? 0 : 2) + (c.status === "approved" ? 0 : 1) }))
    .sort((a, b) => a.rank - b.rank || a.c.seq - b.c.seq)
    .map((x) => x.c);
}

/** Products for a new claim made from a node: the catalog products of the Master Thought's sub-categories. */
export function scopeMenusForNode(menuSubService: Map<string, string | null>, subServiceIds: string[]): string[] {
  if (!subServiceIds.length) return [];
  return [...menuSubService].filter(([, sub]) => sub && subServiceIds.includes(sub)).map(([id]) => id);
}
