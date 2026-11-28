import { isClaimExpired, type Claim } from "@/6-1-content-studio/claims/claimsData";
import { linkedClaims, thinkingRef } from "@/thinking-lab/claims/thinkingClaims";

export const BRIEF_CLAIM_MODULE = "ai_employee";

export function briefClaimRef(employeeId: string): string {
  return `brief:${employeeId}`;
}

export const approvedNow = (c: Claim) => c.status === "approved" && !isClaimExpired(c);

/** The approved claims an AI Employee may state: picked here, brand-wide, or behind the brief's Fokus angle. */
export function allowedBriefClaims(claims: Claim[], employeeId: string, angleIds: string[]) {
  const picked = claims.filter((c) => c.uses.some((u) => u.module === BRIEF_CLAIM_MODULE && u.ref_id === briefClaimRef(employeeId)));
  const fromAngle = linkedClaims(claims, angleIds.map((id) => thinkingRef("angle", id)));
  const brand = claims.filter((c) => c.scopes.some((s) => s.scope === "brand"));
  return {
    picked: picked.filter(approvedNow),
    fromAngle: fromAngle.filter(approvedNow),
    brand: brand.filter(approvedNow),
    /** Picked or angle claims that are not approved: the AI will not get them. */
    waiting: [...picked, ...fromAngle].filter((c) => !approvedNow(c)),
  };
}

