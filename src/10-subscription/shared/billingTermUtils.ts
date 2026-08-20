import type { TFunction } from "i18next";
import {
  isEnterpriseSubscriptionPlan,
  isScaleUpSubscriptionPlanName,
} from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";

export type BillingTermMonths = 1 | 3 | 6 | 12;
export type BillingTermKey = "1" | "3" | "6" | "12";

export type BillingTermDiscounts = Partial<Record<BillingTermKey, number | null>>;

export const BILLING_TERM_OPTIONS: BillingTermMonths[] = [1, 3, 6, 12];

export function coerceBillingTermMonths(value: unknown): BillingTermMonths {
  const n = Number(value);
  if (n === 3 || n === 6 || n === 12) return n;
  return 1;
}

export function billingCycleFromTerm(months: BillingTermMonths): "monthly" | "yearly" {
  return months === 12 ? "yearly" : "monthly";
}

export function usesBillingTermSelector(
  plan: Pick<SubscriptionPlan, "name" | "is_custom">,
): boolean {
  return isScaleUpSubscriptionPlanName(plan.name) || isEnterpriseSubscriptionPlan(plan);
}

export function defaultBillingTermForPlan(
  plan: Pick<SubscriptionPlan, "name" | "is_custom">,
  currentTermMonths?: number | null,
): BillingTermMonths {
  if (isEnterpriseSubscriptionPlan(plan)) {
    const coerced = coerceBillingTermMonths(currentTermMonths);
    return coerced === 1 ? 3 : coerced;
  }
  if (currentTermMonths != null) {
    return coerceBillingTermMonths(currentTermMonths);
  }
  return 1;
}

export function resolveTermDiscount(
  plan: Pick<SubscriptionPlan, "billing_term_discounts" | "annual_discount_percentage">,
  months: BillingTermMonths,
): number | null {
  const key = String(months) as BillingTermKey;
  const fromJson = plan.billing_term_discounts?.[key];
  if (fromJson != null && Number.isFinite(Number(fromJson))) {
    return Number(fromJson);
  }
  if (months === 12 && plan.annual_discount_percentage != null) {
    return plan.annual_discount_percentage;
  }
  return null;
}

export function computeTermPriceIdr(
  basePricePerMember: number,
  memberCount: number,
  months: BillingTermMonths,
  discountPercent?: number | null,
): number {
  const base = Number(basePricePerMember);
  const count = Number(memberCount);
  const subtotal =
    (Number.isFinite(base) ? base : 0) * (Number.isFinite(count) ? count : 0) * months;
  if (discountPercent == null || !Number.isFinite(Number(discountPercent)) || discountPercent <= 0) {
    return subtotal;
  }
  return subtotal * (1 - Number(discountPercent) / 100);
}

export function computePlanTermPriceIdr(
  plan: Pick<SubscriptionPlan, "base_price_per_member" | "billing_term_discounts" | "annual_discount_percentage">,
  memberCount: number,
  months: BillingTermMonths,
): number {
  return computeTermPriceIdr(
    plan.base_price_per_member,
    memberCount,
    months,
    resolveTermDiscount(plan, months),
  );
}

export function billingTermLabelKey(months: BillingTermMonths): string {
  return `subscription.plans.billingTerm.${months}`;
}

export function formatBillingTermLabel(months: BillingTermMonths, t: TFunction): string {
  return t(billingTermLabelKey(months));
}

export function billingTermMonthsFromLegacyCycle(
  billingCycle: string | null | undefined,
): BillingTermMonths {
  return billingCycle === "yearly" ? 12 : 1;
}

export function resolveBillingPeriodMonths(
  billingCycle: "monthly" | "yearly",
  billingTermMonths?: BillingTermMonths,
): BillingTermMonths {
  return billingTermMonths ?? billingTermMonthsFromLegacyCycle(billingCycle);
}

export function resolveBillingPeriodLabel(
  months: BillingTermMonths,
  keys: { one: string; twelve: string; term: string },
  t: TFunction,
  extra?: Record<string, unknown>,
): string {
  if (months === 1) return t(keys.one, extra);
  if (months === 12) return t(keys.twelve, extra);
  return t(keys.term, { months, ...extra });
}

/** Short heading for price breakdown rows, e.g. "HR plan · 3 months". */
export function hrPlanTermHeading(months: BillingTermMonths, t: TFunction): string {
  return resolveBillingPeriodLabel(months, {
    one: "subscription.plans.priceBreakdown.hrTermHeading.one",
    twelve: "subscription.plans.priceBreakdown.hrTermHeading.twelve",
    term: "subscription.plans.priceBreakdown.hrTermHeading.term",
  }, t);
}

/** Formula caption under HR line, e.g. "5 members × Rp 99.000 × 3 months". */
export function hrPlanTermFormula(
  months: BillingTermMonths,
  memberCount: number,
  perMemberFormatted: string,
  t: TFunction,
): string {
  return resolveBillingPeriodLabel(months, {
    one: "subscription.plans.priceBreakdown.hrTermFormula.one",
    twelve: "subscription.plans.priceBreakdown.hrTermFormula.twelve",
    term: "subscription.plans.priceBreakdown.hrTermFormula.term",
  }, t, { count: memberCount, perMember: perMemberFormatted, months });
}

/** Formula caption for add-on subtotal (per seat or per org). */
export function addOnTermFormulaCaption(
  months: BillingTermMonths,
  quantity: number,
  unitFormatted: string,
  isFlatOrg: boolean,
  t: TFunction,
  unitNoun: "seat" | "outlet" = "seat",
): string {
  if (isFlatOrg) {
    return resolveBillingPeriodLabel(months, {
      one: "subscription.plans.addOnFormula.perOrg.one",
      twelve: "subscription.plans.addOnFormula.perOrg.twelve",
      term: "subscription.plans.addOnFormula.perOrg.term",
    }, t, { unit: unitFormatted, months });
  }
  if (unitNoun === "outlet") {
    return resolveBillingPeriodLabel(months, {
      one: "subscription.plans.addOnFormula.perOutlet.one",
      twelve: "subscription.plans.addOnFormula.perOutlet.twelve",
      term: "subscription.plans.addOnFormula.perOutlet.term",
    }, t, { qty: quantity, unit: unitFormatted, months });
  }
  return resolveBillingPeriodLabel(months, {
    one: "subscription.plans.addOnFormula.perSeat.one",
    twelve: "subscription.plans.addOnFormula.perSeat.twelve",
    term: "subscription.plans.addOnFormula.perSeat.term",
  }, t, { qty: quantity, unit: unitFormatted, months });
}

export function resolvePlanBillingSelection(
  plan: Pick<SubscriptionPlan, "id" | "name" | "is_custom">,
  billingCycles: Record<string, "monthly" | "yearly">,
  billingTerms: Record<string, BillingTermMonths>,
  currentOrgTermMonths?: number | null,
): { billingCycle: "monthly" | "yearly"; billingTermMonths: BillingTermMonths } {
  if (usesBillingTermSelector(plan)) {
    const billingTermMonths =
      billingTerms[plan.id] ?? defaultBillingTermForPlan(plan, currentOrgTermMonths);
    return {
      billingTermMonths,
      billingCycle: billingCycleFromTerm(billingTermMonths),
    };
  }
  const billingCycle = billingCycles[plan.id] || "monthly";
  return {
    billingCycle,
    billingTermMonths: billingTermMonthsFromLegacyCycle(billingCycle),
  };
}
