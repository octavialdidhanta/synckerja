import type { SubscriptionPlanRow } from "@/0-onboarding/types/subscriptionPlan";

/**
 * Onboarding uses linear `base_price_per_member * memberCount` only.
 * `member_discount_tiers` (if present) is intentionally ignored here; apply on the billing page later.
 */
export function monthlyTotalIDR(plan: SubscriptionPlanRow, memberCount: number): number {
  const n = Math.max(0, Number(plan.base_price_per_member) * Math.max(1, memberCount));
  return Math.round(n);
}

export function yearlyTotalIDR(plan: SubscriptionPlanRow, memberCount: number): number {
  const monthly = monthlyTotalIDR(plan, memberCount);
  const baseYear = monthly * 12;
  const pct = plan.annual_discount_percentage;
  if (pct != null && pct > 0) {
    return Math.round(baseYear * (1 - Number(pct) / 100));
  }
  return baseYear;
}

export function displayTotalForBillingCycle(
  plan: SubscriptionPlanRow,
  memberCount: number,
  billingCycle: "monthly" | "yearly",
): number {
  return billingCycle === "yearly" ? yearlyTotalIDR(plan, memberCount) : monthlyTotalIDR(plan, memberCount);
}
