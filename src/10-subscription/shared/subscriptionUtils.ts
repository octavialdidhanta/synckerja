import { differenceInCalendarDays, startOfDay } from "date-fns";
import {
  billingCycleFromTerm,
  computeTermPriceIdr,
  resolveBillingPeriodMonths,
  resolveTermDiscount,
  type BillingTermMonths,
} from "@/10-subscription/shared/billingTermUtils";
import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";
import type { SubscriptionPlan, SubscriptionPlanAddOnLink } from "@/10-subscription/types/SubscriptionPlanCatalog";

/** End-of-period ISO from RPC subscription status (trial or paid). */
export function resolveSubscriptionExpiryEndIso(status: Pick<
  SubscriptionStatus,
  "is_trial" | "trial_end_date" | "subscription_end_date" | "end_date"
>): string | undefined {
  // Prefer paid period end when present (handles stale is_trial after paid subscription).
  if (status.subscription_end_date) {
    return status.subscription_end_date;
  }
  if (status.is_trial) {
    return status.trial_end_date || status.end_date;
  }
  return status.subscription_end_date || status.end_date;
}

/** Calendar days from reference (default: start of today) to expiry date; negative if already past. */
export function computeCalendarDaysUntilExpiry(
  endDateIso: string | null | undefined,
  reference: Date = startOfDay(new Date()),
): number {
  if (!endDateIso) return 9999;
  const end = startOfDay(new Date(endDateIso));
  if (!Number.isFinite(end.getTime())) return 0;
  return differenceInCalendarDays(end, startOfDay(reference));
}

export function deriveSubscriptionDaysRemaining(
  status: Pick<SubscriptionStatus, "is_expired" | "is_trial" | "trial_end_date" | "subscription_end_date" | "end_date">,
): number {
  if (status.is_expired) return 0;
  const endIso = resolveSubscriptionExpiryEndIso(status);
  const days = computeCalendarDaysUntilExpiry(endIso);
  return Math.max(0, days);
}

type SubscriptionRemainingDaysSlice = Pick<
  SubscriptionStatus,
  | "is_expired"
  | "is_trial"
  | "trial_end_date"
  | "subscription_end_date"
  | "end_date"
  | "days_remaining"
  | "days_until_expiry"
>;

/** True when paid/trial period still has calendar days left (no mid-cycle downgrade/refund). */
export function isMidCycleActiveSubscription(
  status: SubscriptionRemainingDaysSlice | null | undefined,
): boolean {
  if (!status || status.is_expired) return false;
  return resolveCheckoutRemainingDays({ subscriptionStatus: status }) > 0;
}

/**
 * Best remaining-days for checkout prorate: max(RPC prorate, subscription status calendar days).
 * Fixes drift when `calculate_prorate_upgrade` uses last-payment window but UI shows long `subscription_end_date`.
 */
export function resolveCheckoutRemainingDays(params: {
  subscriptionStatus: SubscriptionRemainingDaysSlice | null | undefined;
  prorateRemainingDays?: number | null;
}): number {
  const derivedRaw = params.subscriptionStatus
    ? deriveSubscriptionDaysRemaining(params.subscriptionStatus)
    : 0;
  const fromDerived =
    derivedRaw >= 9999 ? 0 : Math.max(0, Math.round(Number(derivedRaw)));
  const fromExplicit = params.subscriptionStatus
    ? Math.max(
        0,
        Math.round(Number(params.subscriptionStatus.days_remaining ?? 0)),
        Math.round(Number(params.subscriptionStatus.days_until_expiry ?? 0)),
      )
    : 0;
  const fromStatus = Math.max(fromExplicit, fromDerived);
  const fromRpc = Math.max(0, Math.round(Number(params.prorateRemainingDays ?? 0)));
  return Math.max(fromStatus, fromRpc);
}

/** Target plan is a downgrade vs current (lower seat price or lower published max members). */
export function isTargetPlanDowngrade(
  currentPlan: Pick<SubscriptionPlan, "base_price_per_member" | "max_members">,
  targetPlan: Pick<SubscriptionPlan, "base_price_per_member" | "max_members">,
): boolean {
  if (targetPlan.base_price_per_member < currentPlan.base_price_per_member) return true;
  const curMax = currentPlan.max_members ?? Number.MAX_SAFE_INTEGER;
  const tgtMax = targetPlan.max_members ?? Number.MAX_SAFE_INTEGER;
  return tgtMax < curMax;
}

/** Format ISO/subscription date strings for mobile + shared UI (replaces legacy `@/features/10-management/utils/dateUtils`). */
export function formatSubscriptionDate(
  input: string | null | undefined,
  options?: { month?: "long" | "short" | "numeric" },
): string {
  if (!input || typeof input !== "string") return "—";
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return "—";
  const month = options?.month ?? "long";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month,
    year: "numeric",
  });
}

export function formatIDR(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export function getMonthlyPriceForMembers(basePrice: number, memberCount: number): number {
  const base = Number(basePrice);
  const count = Number(memberCount);
  return (Number.isFinite(base) ? base : 0) * (Number.isFinite(count) ? count : 0);
}

export function getYearlyPriceForMembers(
  basePrice: number,
  memberCount: number,
  annualDiscountPercent?: number | null,
): number {
  return computeTermPriceIdr(basePrice, memberCount, 12, annualDiscountPercent ?? 20);
}

export function getTermPriceForMembers(
  basePrice: number,
  memberCount: number,
  termMonths: BillingTermMonths,
  discountPercent?: number | null,
): number {
  return computeTermPriceIdr(basePrice, memberCount, termMonths, discountPercent);
}

/** Fallback IDR per roster staff / month when DB has no `subscription_plan_add_ons` row. */
export const OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY = 125_000;

export const OMNICHANNEL_ROSTER_ADD_ON_CODE = "omnichannel_roster" as const;

/** Flat per-organization add-on (qty always 1). */
export const LEAD_MAGNET_ADD_ON_CODE = "lead_magnet" as const;

export const LEAD_MAGNET_ADDON_IDR_PER_ORG_MONTHLY = 99_000;

/** Extra POS outlets (HQ is always included; billed units are extras). */
export const POS_OUTLETS_ADD_ON_CODE = "pos_outlets" as const;

export const POS_OUTLETS_ADD_ON_MAX = 20;

export const POS_OUTLETS_ADDON_IDR_PER_OUTLET_MONTHLY = 99_000;

export function isFlatPerOrganizationAddOn(billingUnit: string | null | undefined): boolean {
  return billingUnit === "per_organization_month";
}

export function isPerOutletMonthAddOn(billingUnit: string | null | undefined): boolean {
  return billingUnit === "per_outlet_month";
}

/** Quantity cap: POS extras are independent of HR member seats. */
export function addOnLineQuantityCap(code: string, memberCount: number): number {
  if (code === POS_OUTLETS_ADD_ON_CODE) return POS_OUTLETS_ADD_ON_MAX;
  return Math.max(1, Math.round(Number(memberCount)) || 1);
}

/** Whether Lead Magnet add-on is included in checkout selections (bundled HR payment). */
export function bundledLeadMagnetFromSelections(
  selections: Record<string, { included: boolean; quantity: number } | undefined>,
): boolean {
  const row = selections[LEAD_MAGNET_ADD_ON_CODE];
  return Boolean(row?.included);
}

/** Seat count for omnichannel roster from merged checkout selections (stored on payment for webhook). */
export function bundledOmnichannelRosterUnitsFromSelections(
  selections: Record<string, { included: boolean; quantity: number } | undefined>,
): number {
  const row = selections[OMNICHANNEL_ROSTER_ADD_ON_CODE];
  if (!row?.included || row.quantity < 1) return 0;
  const q = Math.round(Number(row.quantity));
  if (!Number.isFinite(q) || q < 1) return 0;
  return Math.min(999, q);
}

/** Extra POS outlet count from merged checkout selections (stored on payment for webhook). */
export function bundledPosOutletUnitsFromSelections(
  selections: Record<string, { included: boolean; quantity: number } | undefined>,
): number {
  const row = selections[POS_OUTLETS_ADD_ON_CODE];
  if (!row?.included || row.quantity < 1) return 0;
  const q = Math.round(Number(row.quantity));
  if (!Number.isFinite(q) || q < 1) return 0;
  return Math.min(POS_OUTLETS_ADD_ON_MAX, q);
}

/** Whether POS product (Sertakan) is included — may be true with 0 extra outlets. */
export function bundledPosAddonFromSelections(
  selections: Record<string, { included: boolean; quantity: number } | undefined>,
): boolean {
  return Boolean(selections[POS_OUTLETS_ADD_ON_CODE]?.included);
}

/** True when checkout enables POS product that was previously inactive. */
export function hasPosAddonEnableDelta(
  selections: Record<string, { included: boolean; quantity: number } | undefined>,
  legacyPosAddonActive: boolean,
): boolean {
  return bundledPosAddonFromSelections(selections) && !legacyPosAddonActive;
}

export type OmnichannelRosterAddonResolved = {
  eligible: boolean;
  unitPricePerStaffMonthly: number;
  followsPlanAnnualDiscount: boolean;
};

type PlanAddonSlice = Pick<
  SubscriptionPlan,
  "name" | "base_price_per_member" | "plan_add_ons" | "billing_term_discounts" | "annual_discount_percentage"
>;

/** Legacy / duplicate tier: omnichannel is sold as add-on on paid HR plans, not as this full card. */
export function isSubscriptionPlanHiddenBusiness(planName: string): boolean {
  const n = planName.trim().toLowerCase();
  return n === "business" || n === "business plan";
}

/** Catalog row that should show omnichannel add-on summary inside the plan card (not only below the grid). */
export function isScaleUpSubscriptionPlanName(planName: string): boolean {
  const n = planName
    .trim()
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ");
  if (n === "scaleup") return true;
  return n === "scale up" || /\bscale up\b/.test(n);
}

/** Upper bound for Enterprise member slider (sales-led; no list price). */
export const ENTERPRISE_SLIDER_MAX_MEMBERS = 500;

type PlanMaxMembersSlice = Pick<
  SubscriptionPlan,
  "name" | "max_members" | "base_price_per_member"
>;

/** Highest published Scale Up cap — Enterprise slider min = this + 1. */
export function resolveScaleUpMaxMembersFromPlans(plans: PlanMaxMembersSlice[]): number {
  const scaleUp = plans.find((p) => isScaleUpSubscriptionPlanName(p.name));
  if (!scaleUp) return 50;
  if (scaleUp.max_members != null && scaleUp.max_members >= 1) {
    return scaleUp.max_members;
  }
  if (Number(scaleUp.base_price_per_member) > 0) return 100;
  return 50;
}

export function resolveEnterpriseSliderMin(plans: PlanMaxMembersSlice[]): number {
  return resolveScaleUpMaxMembersFromPlans(plans) + 1;
}

/** Sales-led tier: 51+ members (above Scale Up cap), custom pricing, no self-serve checkout. */
export function isEnterpriseSubscriptionPlanName(planName: string): boolean {
  const n = planName
    .trim()
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ");
  if (n === "enterprise") return true;
  return n === "enterprise plan" || /\benterprise\b/.test(n);
}

export function isEnterpriseSubscriptionPlan(
  plan: Pick<SubscriptionPlan, "name" | "is_custom">,
): boolean {
  return Boolean(plan.is_custom) || isEnterpriseSubscriptionPlanName(plan.name);
}

/** WhatsApp sales line for Enterprise (international format without +). */
export const ENTERPRISE_SALES_WHATSAPP = "6281118891308";

export function buildEnterpriseSalesWhatsAppUrl(message: string): string {
  return `https://wa.me/${ENTERPRISE_SALES_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

type PlanSortSlice = Pick<SubscriptionPlan, "name" | "base_price_per_member" | "is_custom">;

function planDisplaySortRank(plan: PlanSortSlice): number {
  if (isEnterpriseSubscriptionPlan(plan)) return 4;
  if (isScaleUpSubscriptionPlanName(plan.name)) return 3;
  if (plan.base_price_per_member > 0) return 2;
  return 1;
}

/** Stable display order: free/trial → paid tiers by price → Scale Up → Enterprise last. */
export function sortSubscriptionPlansForDisplay<T extends PlanSortSlice>(plans: T[]): T[] {
  return [...plans].sort((a, b) => {
    const rankDiff = planDisplaySortRank(a) - planDisplaySortRank(b);
    if (rankDiff !== 0) return rankDiff;
    if (planDisplaySortRank(a) === 2) {
      return a.base_price_per_member - b.base_price_per_member;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Eligibility when `plan_add_ons` is absent (pre-migration or empty). Mirrors previous client-only rules. */
function planEligibleForOmnichannelAddonDisplayLegacy(plan: { name: string; base_price_per_member: number }): boolean {
  const n = plan.name.trim().toLowerCase();
  if (plan.base_price_per_member === 0 || n === "trial") return false;
  if (isSubscriptionPlanHiddenBusiness(plan.name)) return false;
  if (/(^|\s)(starter|start\s*up|startup)(\s|$)/i.test(plan.name)) return false;
  return true;
}

/** Sort linked catalog add-ons for display / billing helpers. */
export function sortPlanAddOnLinks(plan: Pick<SubscriptionPlan, "plan_add_ons">): SubscriptionPlanAddOnLink[] {
  return [...(plan.plan_add_ons ?? [])]
    .filter((l) => l.subscription_add_ons?.is_active !== false)
    .sort((a, b) => a.display_order - b.display_order);
}

/** Whether the plan has at least one active catalog add-on junction row. */
export function planHasCatalogAddOns(plan: Pick<SubscriptionPlan, "plan_add_ons">): boolean {
  return sortPlanAddOnLinks(plan).length > 0;
}

/** Add-ons sidebar: current subscribed plan with catalog add-ons. */
export function shouldShowAddOnsSidebar(
  plan: Pick<SubscriptionPlan, "plan_add_ons">,
  isCurrent: boolean,
): boolean {
  return isCurrent && planHasCatalogAddOns(plan);
}

/** @deprecated Use shouldShowAddOnsSidebar — kept for transitional imports. */
export function shouldShowAdjacentAddOnsPanel(
  plan: Pick<SubscriptionPlan, "plan_add_ons">,
  isCurrent: boolean,
): boolean {
  return shouldShowAddOnsSidebar(plan, isCurrent);
}

export type RelocateAddOnDetailParams = {
  showAddOnsSidebar?: boolean;
  /** @deprecated Alias for showAddOnsSidebar */
  showAdjacentAddOns?: boolean;
  isExpired?: boolean;
  isRenewEligible?: boolean;
};

/** When true, add-on summary/pricing lives in sidebar — not duplicated on PlanCard. */
export function relocateAddOnDetailToPanel(params: RelocateAddOnDetailParams): boolean {
  const showSidebar = params.showAddOnsSidebar ?? params.showAdjacentAddOns ?? false;
  return showSidebar || Boolean(params.isExpired) || Boolean(params.isRenewEligible);
}

export type AddOnSelectionDisplayRow = {
  code: string;
  name: string;
  quantity: number;
  amountIdr: number;
  isOmnichannel: boolean;
  isFlatOrg: boolean;
};

/** Line amount for one included catalog add-on row. */
export function computeAddOnSelectionLineAmountIdr(
  link: SubscriptionPlanAddOnLink,
  quantity: number,
  billingCycle: "monthly" | "yearly",
  annualDiscountPercent: number | null | undefined,
  billingTermMonths?: BillingTermMonths,
): number {
  const effectiveQty = Math.max(0, Math.round(Number(quantity)) || 0);
  const unit = resolvePlanAddOnUnitMonthly(link);
  const termMonths = billingTermMonths ?? (billingCycle === "yearly" ? 12 : 1);
  const followsPlan = link.subscription_add_ons.follows_plan_annual_discount !== false;
  const discount = followsPlan ? annualDiscountPercent : 20;
  return computeTermPriceIdr(unit, effectiveQty, termMonths, discount);
}

/** UI-only add-on rows for panel summary (included selections only). */
export function summarizeAddOnSelectionsForDisplay(
  plan: Pick<
    SubscriptionPlan,
    "plan_add_ons" | "annual_discount_percentage" | "billing_term_discounts"
  >,
  selections: PlanAddOnSelectionMap,
  memberCount: number,
  billingCycle: "monthly" | "yearly" = "monthly",
  billingTermMonths?: BillingTermMonths,
): AddOnSelectionDisplayRow[] {
  const seatCap = Math.max(1, memberCount);
  const termMonths = billingTermMonths ?? (billingCycle === "yearly" ? 12 : 1);
  const termDiscount = resolveTermDiscount(plan, termMonths);
  const rows: AddOnSelectionDisplayRow[] = [];
  for (const link of sortPlanAddOnLinks(plan)) {
    const code = link.subscription_add_ons.code;
    const sel = selections[code];
    if (!sel?.included) continue;
    const isFlatOrg = isFlatPerOrganizationAddOn(link.subscription_add_ons.billing_unit);
    const isOmni = code === OMNICHANNEL_ROSTER_ADD_ON_CODE;
    const lineCap = addOnLineQuantityCap(code, seatCap);
    const quantity = isFlatOrg
      ? 1
      : Math.min(lineCap, Math.max(1, Math.round(Number(sel.quantity)) || 1));
    rows.push({
      code,
      name: link.subscription_add_ons.name,
      quantity,
      amountIdr: computeAddOnSelectionLineAmountIdr(
        link,
        quantity,
        billingCycle,
        termDiscount,
        termMonths,
      ),
      isOmnichannel: isOmni,
      isFlatOrg,
    });
  }
  return rows;
}

export function resolvePlanAddOnUnitMonthly(link: SubscriptionPlanAddOnLink): number {
  const def = Number(link.subscription_add_ons.default_unit_price_per_month);
  const ov = link.unit_price_override_per_month;
  if (ov != null && Number.isFinite(Number(ov))) return Math.max(0, Number(ov));
  if (Number.isFinite(def)) return Math.max(0, def);
  return 0;
}

/** Pricing breakdown for one catalog add-on line (gross, discount, net). */
export function describeCatalogAddOnLinePricing(params: {
  link: SubscriptionPlanAddOnLink;
  quantity: number;
  plan: PlanAddonSlice;
  billingCycle: "monthly" | "yearly";
  billingTermMonths?: BillingTermMonths;
}): {
  termMonths: BillingTermMonths;
  unit: number;
  quantity: number;
  discountPct: number | null;
  grossIdr: number;
  netIdr: number;
  discountAmountIdr: number;
} {
  const termMonths = resolveBillingPeriodMonths(params.billingCycle, params.billingTermMonths);
  const unit = resolvePlanAddOnUnitMonthly(params.link);
  const quantity = Math.max(0, Math.round(Number(params.quantity)) || 0);
  const followsPlan = params.link.subscription_add_ons.follows_plan_annual_discount !== false;
  const discountPct = followsPlan ? resolveTermDiscount(params.plan, termMonths) : 20;
  const grossIdr = computeTermPriceIdr(unit, quantity, termMonths, null);
  const netIdr = computeTermPriceIdr(unit, quantity, termMonths, discountPct);
  return {
    termMonths,
    unit,
    quantity,
    discountPct: discountPct != null && discountPct > 0 ? discountPct : null,
    grossIdr,
    netIdr,
    discountAmountIdr: Math.max(0, grossIdr - netIdr),
  };
}

/** Per-line total for a catalog add-on row (respects billing term months + term discount). */
export function computeCatalogAddOnLineAmountIdr(params: {
  link: SubscriptionPlanAddOnLink;
  quantity: number;
  plan: PlanAddonSlice;
  billingCycle: "monthly" | "yearly";
  billingTermMonths?: BillingTermMonths;
}): number {
  const termMonths = resolveBillingPeriodMonths(params.billingCycle, params.billingTermMonths);
  return computeAddOnSelectionLineAmountIdr(
    params.link,
    params.quantity,
    params.billingCycle,
    resolveTermDiscount(params.plan, termMonths),
    termMonths,
  );
}

/** Per-line yearly total for a catalog add-on (same rules as omnichannel roster add-on). */
export function computePlanAddOnLineYearlyTotalIdr(
  quantity: number,
  unitMonthly: number,
  followsPlanAnnualDiscount: boolean,
  annualDiscountPercent: number | null | undefined,
): number {
  const monthly = Math.max(0, Number(quantity)) * Math.max(0, Number(unitMonthly));
  const discountSource = followsPlanAnnualDiscount ? annualDiscountPercent : 20;
  const discount =
    discountSource != null && Number.isFinite(Number(discountSource)) ? Number(discountSource) : 20;
  return monthly * 12 * (1 - discount / 100);
}

export type PlanAddOnSelectionMap = Record<string, { included: boolean; quantity: number } | undefined>;

export type PaidAddOnBaselines = {
  omnichannelPaidSeats: number;
  leadMagnetActive: boolean;
  posPaidOutletCount?: number;
  /** POS product active (Sertakan), independent of extra outlet qty. */
  posAddonActive?: boolean;
};

/** Paid entitlement baseline per add-on code (from DB, not UI). */
export function paidAddOnBaselineQty(
  code: string,
  baselines: PaidAddOnBaselines,
): number {
  if (code === OMNICHANNEL_ROSTER_ADD_ON_CODE) {
    return Math.max(0, Math.round(Number(baselines.omnichannelPaidSeats)) || 0);
  }
  if (code === LEAD_MAGNET_ADD_ON_CODE && baselines.leadMagnetActive) return 1;
  if (code === POS_OUTLETS_ADD_ON_CODE) {
    return Math.max(0, Math.round(Number(baselines.posPaidOutletCount ?? 0)) || 0);
  }
  return 0;
}

/** Whether POS product is entitled (flag or legacy paid extras). */
export function isPosAddonActiveFromBaselines(baselines: PaidAddOnBaselines): boolean {
  if (baselines.posAddonActive === true) return true;
  return Math.max(0, Math.round(Number(baselines.posPaidOutletCount ?? 0)) || 0) > 0;
}

function clampAddonSelectionQty(
  code: string,
  included: boolean,
  quantity: number,
  cap: number,
  isFlatOrg: boolean,
): number {
  if (!included) {
    if (code === POS_OUTLETS_ADD_ON_CODE) {
      return Math.min(cap, Math.max(0, Math.round(Number(quantity)) || 0));
    }
    return isFlatOrg ? 1 : Math.max(0, Math.round(Number(quantity)) || 0);
  }
  if (isFlatOrg) return 1;
  if (code === POS_OUTLETS_ADD_ON_CODE) {
    return Math.min(cap, Math.max(0, Math.round(Number(quantity)) || 0));
  }
  return Math.min(cap, Math.max(1, Math.round(Number(quantity)) || 1));
}

/**
 * Merge stored UI state with defaults.
 * Stored `planAddOnUi` wins over DB baseline (enables slider upgrade, schedule-off, renew custom addons).
 * DB baseline only seeds when no stored row exists for that code.
 */
export function mergePlanAddOnSelections(
  plan: Pick<SubscriptionPlan, "plan_add_ons">,
  stored: Record<string, { included: boolean; quantity: number }> | undefined,
  isCurrentPlan: boolean,
  omnichannelPaidSeats: number,
  /** Add-on billed units cannot exceed selected HR member (seat) count (POS uses its own cap). */
  maxAddonQuantityPerLine: number,
  leadMagnetActive = false,
  posPaidOutletCount = 0,
  posAddonActive = false,
): Record<string, { included: boolean; quantity: number }> {
  const cap = Math.max(1, Math.round(Number(maxAddonQuantityPerLine)) || 1);
  const baselines: PaidAddOnBaselines = {
    omnichannelPaidSeats,
    leadMagnetActive,
    posPaidOutletCount,
    posAddonActive,
  };

  const out: Record<string, { included: boolean; quantity: number }> = {};
  for (const link of sortPlanAddOnLinks(plan)) {
    const code = link.subscription_add_ons.code;
    const prev = stored?.[code];
    const isFlatOrg = isFlatPerOrganizationAddOn(link.subscription_add_ons.billing_unit);
    const lineCap = addOnLineQuantityCap(code, cap);
    if (prev) {
      const included = Boolean(prev.included);
      out[code] = {
        included,
        quantity: clampAddonSelectionQty(code, included, prev.quantity, lineCap, isFlatOrg),
      };
      continue;
    }

    if (code === OMNICHANNEL_ROSTER_ADD_ON_CODE && isCurrentPlan) {
      const paid = Math.max(0, Math.round(Number(omnichannelPaidSeats)) || 0);
      out[code] = {
        included: paid > 0,
        quantity: paid > 0 ? Math.min(lineCap, Math.max(1, paid)) : 1,
      };
      continue;
    }
    if (code === LEAD_MAGNET_ADD_ON_CODE && isCurrentPlan && leadMagnetActive) {
      out[code] = { included: true, quantity: 1 };
      continue;
    }
    if (code === POS_OUTLETS_ADD_ON_CODE && isCurrentPlan) {
      const paid = Math.max(0, Math.round(Number(posPaidOutletCount)) || 0);
      const active = isPosAddonActiveFromBaselines(baselines);
      out[code] = {
        included: active,
        quantity: Math.min(lineCap, Math.max(0, paid)),
      };
      continue;
    }
    out[code] = {
      included: false,
      quantity: code === POS_OUTLETS_ADD_ON_CODE ? 0 : 1,
    };
  }
  return out;
}

/** True when any catalog add-on selection is below paid baseline (disable or fewer seats). */
export function isAddonSelectionDowngrade(
  plan: Pick<SubscriptionPlan, "plan_add_ons">,
  selections: PlanAddOnSelectionMap,
  baselines: PaidAddOnBaselines,
): boolean {
  for (const link of sortPlanAddOnLinks(plan)) {
    const code = link.subscription_add_ons.code;
    const sel = selections[code];
    if (code === POS_OUTLETS_ADD_ON_CODE) {
      if (isPosAddonActiveFromBaselines(baselines) && !sel?.included) return true;
      const qtyBaseline = paidAddOnBaselineQty(code, baselines);
      if (qtyBaseline <= 0) continue;
      const selectedQty = Math.max(0, Math.round(Number(sel?.quantity)) || 0);
      if (selectedQty < qtyBaseline) return true;
      continue;
    }
    const baseline = paidAddOnBaselineQty(code, baselines);
    if (baseline <= 0) continue;
    if (!sel?.included) return true;
    const isFlatOrg = isFlatPerOrganizationAddOn(link.subscription_add_ons.billing_unit);
    const selectedQty = isFlatOrg ? 1 : Math.max(0, Math.round(Number(sel.quantity)) || 0);
    if (selectedQty < baseline) return true;
  }
  return false;
}

export type SchedulableDowngradeParams = {
  isCurrentPlan: boolean;
  memberCount: number;
  currentMemberCount: number;
  billingCycle: string;
  currentBillingCycle: string;
  plan: PlanAddonSlice;
  selections: PlanAddOnSelectionMap;
  legacyOmnichannelPaidSeatCount: number;
  legacyLeadMagnetActive?: boolean;
  legacyPosPaidOutletCount?: number;
  legacyPosAddonActive?: boolean;
  isTargetPlanDowngrade?: boolean;
  currentEmployeeCount?: number;
  rosterCount?: number;
  /** When true (renewal window), add-on-only downgrades are handled via renew checkout — not scheduled. */
  isRenewWindow?: boolean;
  /** When true, period already ended — scheduling is not allowed. */
  isExpired?: boolean;
};

/** Downgrade (HR, billing, plan, or add-on) that must be scheduled — not charged immediately. */
export function hasSchedulableDowngrade(params: SchedulableDowngradeParams): boolean {
  if (params.isExpired) return false;
  if (!params.isCurrentPlan) {
    return Boolean(params.isTargetPlanDowngrade);
  }
  if (params.memberCount < params.currentMemberCount) {
    const employees = params.currentEmployeeCount ?? 0;
    if (employees > params.memberCount) return false;
    return true;
  }
  if (
    params.currentBillingCycle === "yearly" &&
    params.billingCycle === "monthly"
  ) {
    return true;
  }
  if (params.isTargetPlanDowngrade) return true;
  const addonDowngrade = isAddonSelectionDowngrade(
    params.plan,
    params.selections,
    {
      omnichannelPaidSeats: params.legacyOmnichannelPaidSeatCount,
      leadMagnetActive: Boolean(params.legacyLeadMagnetActive),
      posPaidOutletCount: params.legacyPosPaidOutletCount ?? 0,
      posAddonActive: Boolean(params.legacyPosAddonActive),
    },
  );
  if (addonDowngrade && params.isRenewWindow) {
    return false;
  }
  return addonDowngrade;
}

/** Selections for renew/checkout — prefer stored UI without re-applying DB floor override. */
export function mergePlanAddOnSelectionsForCheckout(
  plan: Pick<SubscriptionPlan, "plan_add_ons">,
  stored: Record<string, { included: boolean; quantity: number }> | undefined,
  maxAddonQuantityPerLine: number,
): Record<string, { included: boolean; quantity: number }> {
  return mergePlanAddOnSelections(plan, stored, false, 0, maxAddonQuantityPerLine, false);
}

/** Snapshot of paid add-on entitlements for schedule request storage. */
export function buildCurrentAddonSnapshot(baselines: PaidAddOnBaselines): Record<string, { included: boolean; quantity: number }> {
  const omni = Math.max(0, Math.round(Number(baselines.omnichannelPaidSeats)) || 0);
  const pos = Math.max(0, Math.round(Number(baselines.posPaidOutletCount ?? 0)) || 0);
  const posActive = isPosAddonActiveFromBaselines(baselines);
  return {
    [OMNICHANNEL_ROSTER_ADD_ON_CODE]: { included: omni > 0, quantity: omni },
    [LEAD_MAGNET_ADD_ON_CODE]: { included: baselines.leadMagnetActive, quantity: baselines.leadMagnetActive ? 1 : 0 },
    [POS_OUTLETS_ADD_ON_CODE]: { included: posActive, quantity: pos },
  };
}

/** Target add-on state persisted on scheduled change (0 qty when disabled). */
export function buildTargetAddonSelectionsForSchedule(
  plan: Pick<SubscriptionPlan, "plan_add_ons">,
  selections: PlanAddOnSelectionMap,
): Record<string, { included: boolean; quantity: number }> {
  const out: Record<string, { included: boolean; quantity: number }> = {};
  for (const link of sortPlanAddOnLinks(plan)) {
    const code = link.subscription_add_ons.code;
    const sel = selections[code];
    const isFlatOrg = isFlatPerOrganizationAddOn(link.subscription_add_ons.billing_unit);
    if (!sel?.included) {
      out[code] = { included: false, quantity: 0 };
      continue;
    }
    out[code] = {
      included: true,
      quantity: isFlatOrg ? 1 : Math.max(0, Math.round(Number(sel.quantity)) || 0),
    };
  }
  return out;
}

export function sumSelectedCatalogAddOnsListAmountIdr(params: {
  plan: PlanAddonSlice;
  billingCycle: "monthly" | "yearly";
  annualDiscountPercent: number | null;
  billingTermMonths?: BillingTermMonths;
  selections: Record<string, { included: boolean; quantity: number } | undefined>;
}): number {
  const termMonths = params.billingTermMonths ?? (params.billingCycle === "yearly" ? 12 : 1);
  const termDiscount = resolveTermDiscount(params.plan, termMonths);
  const links = sortPlanAddOnLinks(params.plan);
  let sum = 0;
  for (const link of links) {
    const code = link.subscription_add_ons.code;
    const sel = params.selections[code];
    if (!sel?.included || sel.quantity < 1) continue;
    sum += computeAddOnSelectionLineAmountIdr(
      link,
      sel.quantity,
      params.billingCycle,
      termDiscount,
      termMonths,
    );
  }
  return sum;
}

export type AddonBillingCalculationSlice = {
  charge_now?: boolean;
  prorate_amount?: number;
  skip_prorate?: boolean;
  remaining_days?: number;
  addon_only_checkout?: boolean;
};

/** True when checkout uses time-based HR prorate from `calculate_prorate_upgrade` (not full list / skip_prorate). */
export function usesHrProrateForAddonBilling(
  calculation: AddonBillingCalculationSlice | null | undefined,
): boolean {
  if (!calculation?.charge_now) return false;
  if (calculation.skip_prorate) return false;
  const pa = Number(calculation.prorate_amount);
  return Number.isFinite(pa) && pa > 0;
}

/** True when add-on billing uses incremental list + prorate (HR prorate path or add-on-only mid-cycle checkout). */
export function usesMidCycleIncrementalAddonProrate(
  calculation: AddonBillingCalculationSlice | null | undefined,
): boolean {
  if (calculation?.addon_only_checkout) return true;
  return usesHrProrateForAddonBilling(calculation);
}

/** UI gate: current plan has unpaid add-on delta and subscription still has remaining days. */
export function hasCheckoutableCatalogAddOnDelta(params: {
  isCurrentPlan: boolean;
  memberCount: number;
  currentMemberCount: number;
  billingCycle: string;
  currentBillingCycle: string;
  plan: PlanAddonSlice;
  annualDiscountPercent: number | null;
  selections: PlanAddOnSelectionMap;
  legacyOmnichannelPaidSeatCount: number;
  legacyLeadMagnetActive?: boolean;
  legacyPosPaidOutletCount?: number;
  legacyPosAddonActive?: boolean;
  isExpired?: boolean;
  remainingDays?: number | null;
}): boolean {
  if (!params.isCurrentPlan) return false;
  if (params.isExpired) return false;
  if (params.memberCount !== params.currentMemberCount) return false;
  if (params.billingCycle !== params.currentBillingCycle) return false;
  const rem = Math.max(0, Math.round(Number(params.remainingDays ?? 0)));
  if (rem <= 0) return false;
  if (hasPosAddonEnableDelta(params.selections, Boolean(params.legacyPosAddonActive))) {
    return true;
  }
  return (
    catalogAddOnIncrementalListAmountIdr({
      plan: params.plan,
      billingCycle: params.billingCycle as "monthly" | "yearly",
      annualDiscountPercent: params.annualDiscountPercent,
      selections: params.selections,
      legacyOmnichannelPaidSeatCount: params.legacyOmnichannelPaidSeatCount,
      legacyLeadMagnetActive: params.legacyLeadMagnetActive,
      legacyPosPaidOutletCount: params.legacyPosPaidOutletCount,
      legacyPosAddonActive: params.legacyPosAddonActive,
    }) > 0
  );
}

/** Checkout path: same HR plan/members/billing with incremental add-ons to bill mid-cycle. */
export function isAddOnOnlyMidCycleCheckout(params: {
  isCurrentPlan: boolean;
  memberCount: number;
  currentMemberCount: number;
  billingCycle: "monthly" | "yearly";
  currentBillingCycle: string;
  plan: PlanAddonSlice;
  annualDiscountPercent: number | null;
  selections: PlanAddOnSelectionMap;
  legacyOmnichannelPaidSeatCount: number;
  legacyLeadMagnetActive?: boolean;
  legacyPosPaidOutletCount?: number;
  legacyPosAddonActive?: boolean;
  isExpired?: boolean;
  remainingDays: number;
}): boolean {
  return hasCheckoutableCatalogAddOnDelta({
    ...params,
    billingCycle: params.billingCycle,
    remainingDays: params.remainingDays,
  });
}

/**
 * List-price total for **new** add-on units only (selected qty minus already-paid baseline).
 * Omnichannel baseline = `legacyOmnichannelPaidSeatCount`; other catalog lines baseline 0 until persisted per line exists.
 */
export function catalogAddOnIncrementalListAmountIdr(params: {
  plan: PlanAddonSlice;
  billingCycle: "monthly" | "yearly";
  annualDiscountPercent: number | null;
  billingTermMonths?: BillingTermMonths;
  selections: PlanAddOnSelectionMap;
  legacyOmnichannelPaidSeatCount: number;
  legacyLeadMagnetActive?: boolean;
  legacyPosPaidOutletCount?: number;
  legacyPosAddonActive?: boolean;
}): number {
  const termMonths = resolveBillingPeriodMonths(params.billingCycle, params.billingTermMonths);
  const paidOmnichannel = Math.max(0, Math.round(Number(params.legacyOmnichannelPaidSeatCount)) || 0);
  const paidPos = Math.max(0, Math.round(Number(params.legacyPosPaidOutletCount ?? 0)) || 0);
  const links = sortPlanAddOnLinks(params.plan);
  if (links.length > 0) {
    let sum = 0;
    for (const link of links) {
      const code = link.subscription_add_ons.code;
      const sel = params.selections[code];
      if (!sel?.included || sel.quantity < 1) continue;
      const baseline = paidAddOnBaselineQty(code, {
        omnichannelPaidSeats: paidOmnichannel,
        leadMagnetActive: Boolean(params.legacyLeadMagnetActive),
        posPaidOutletCount: paidPos,
        posAddonActive: Boolean(params.legacyPosAddonActive),
      });
      const deltaQty = Math.max(0, Math.round(Number(sel.quantity)) - baseline);
      if (deltaQty < 1) continue;
      sum += computeCatalogAddOnLineAmountIdr({
        link,
        quantity: deltaQty,
        plan: params.plan,
        billingCycle: params.billingCycle,
        billingTermMonths: termMonths,
      });
    }
    return sum;
  }
  const cfg = getOmnichannelRosterAddonConfig(params.plan);
  if (!cfg.eligible) return 0;
  const sel = params.selections[OMNICHANNEL_ROSTER_ADD_ON_CODE];
  const selectedQty =
    sel?.included && sel.quantity >= 1 ? Math.max(1, Math.round(Number(sel.quantity)) || 1) : 0;
  const deltaQty = Math.max(0, selectedQty - paidOmnichannel);
  if (deltaQty < 1) return 0;
  const termDiscount = resolveTermDiscount(params.plan, termMonths);
  if (termMonths > 1) {
    return computeTermPriceIdr(
      cfg.unitPricePerStaffMonthly,
      deltaQty,
      termMonths,
      cfg.followsPlanAnnualDiscount ? termDiscount : 20,
    );
  }
  return getOmnichannelAddonMonthlyTotalIdr(deltaQty, cfg.unitPricePerStaffMonthly);
}

/**
 * Prorates incremental add-on list amount for the remaining subscription window (aligned with `calculate_prorate_upgrade`: /30 monthly, /365 yearly).
 */
export function proratedCatalogAddonChargeIdr(params: {
  incrementalListAmountIdr: number;
  billingCycle: "monthly" | "yearly";
  remainingDays: number;
}): number {
  const inc = Math.max(0, Number(params.incrementalListAmountIdr));
  const rem = Math.max(0, Math.round(Number(params.remainingDays)) || 0);
  if (inc <= 0 || rem <= 0) return 0;
  if (params.billingCycle === "yearly") {
    return Math.round((inc * rem) / 365);
  }
  return Math.round((inc * rem) / 30);
}

/**
 * Add-on portion for Midtrans gross: full catalog list when not on HR prorate path; otherwise incremental add-on prorata only.
 */
export function catalogAddonChargeForMidtransSplit(params: {
  plan: PlanAddonSlice;
  billingCycle: "monthly" | "yearly";
  annualDiscountPercent: number | null;
  billingTermMonths?: BillingTermMonths;
  selections: PlanAddOnSelectionMap;
  legacyOmnichannelPaidSeatCount: number;
  legacyLeadMagnetActive?: boolean;
  legacyPosPaidOutletCount?: number;
  legacyPosAddonActive?: boolean;
  calculation: AddonBillingCalculationSlice | null | undefined;
}): number {
  if (usesMidCycleIncrementalAddonProrate(params.calculation)) {
    const inc = catalogAddOnIncrementalListAmountIdr({
      plan: params.plan,
      billingCycle: params.billingCycle,
      annualDiscountPercent: params.annualDiscountPercent,
      billingTermMonths: params.billingTermMonths,
      selections: params.selections,
      legacyOmnichannelPaidSeatCount: params.legacyOmnichannelPaidSeatCount,
      legacyLeadMagnetActive: params.legacyLeadMagnetActive,
      legacyPosPaidOutletCount: params.legacyPosPaidOutletCount,
      legacyPosAddonActive: params.legacyPosAddonActive,
    });
    return proratedCatalogAddonChargeIdr({
      incrementalListAmountIdr: inc,
      billingCycle: params.billingCycle,
      remainingDays: params.calculation?.remaining_days ?? 0,
    });
  }
  return catalogAddOnListAmountForMidtransSplit({
    plan: params.plan,
    billingCycle: params.billingCycle,
    annualDiscountPercent: params.annualDiscountPercent,
    billingTermMonths: params.billingTermMonths,
    selections: params.selections,
    legacyOmnichannelPaidSeatCount: params.legacyOmnichannelPaidSeatCount,
  });
}

/** List-price total of add-ons for Midtrans split: selected junction rows, else legacy omnichannel-only fallback. */
export function catalogAddOnListAmountForMidtransSplit(params: {
  plan: PlanAddonSlice;
  billingCycle: "monthly" | "yearly";
  annualDiscountPercent: number | null;
  billingTermMonths?: BillingTermMonths;
  selections: Record<string, { included: boolean; quantity: number } | undefined>;
  legacyOmnichannelPaidSeatCount: number;
}): number {
  const termMonths = params.billingTermMonths ?? (params.billingCycle === "yearly" ? 12 : 1);
  const termDiscount = resolveTermDiscount(params.plan, termMonths);
  if (sortPlanAddOnLinks(params.plan).length > 0) {
    return sumSelectedCatalogAddOnsListAmountIdr({
      plan: params.plan,
      billingCycle: params.billingCycle,
      annualDiscountPercent: params.annualDiscountPercent,
      billingTermMonths: termMonths,
      selections: params.selections,
    });
  }
  const cfg = getOmnichannelRosterAddonConfig(params.plan);
  if (!cfg.eligible || params.legacyOmnichannelPaidSeatCount <= 0) return 0;
  if (termMonths > 1) {
    return computeTermPriceIdr(
      cfg.unitPricePerStaffMonthly,
      params.legacyOmnichannelPaidSeatCount,
      termMonths,
      cfg.followsPlanAnnualDiscount ? termDiscount : 20,
    );
  }
  if (params.billingCycle === "yearly") {
    return getOmnichannelAddonYearlyTotalIdr(
      params.legacyOmnichannelPaidSeatCount,
      params.annualDiscountPercent,
      cfg.unitPricePerStaffMonthly,
      cfg.followsPlanAnnualDiscount,
    );
  }
  return getOmnichannelAddonMonthlyTotalIdr(params.legacyOmnichannelPaidSeatCount, cfg.unitPricePerStaffMonthly);
}

export function getOmnichannelRosterAddonConfig(plan: PlanAddonSlice): OmnichannelRosterAddonResolved {
  const links = plan.plan_add_ons;
  const row = links?.find(
    (l) =>
      l.subscription_add_ons?.code === OMNICHANNEL_ROSTER_ADD_ON_CODE && l.subscription_add_ons.is_active !== false,
  );
  if (row?.subscription_add_ons) {
    const def = Number(row.subscription_add_ons.default_unit_price_per_month);
    const ov = row.unit_price_override_per_month;
    const unit =
      ov != null && Number.isFinite(Number(ov)) ? Number(ov) : Number.isFinite(def) ? def : OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY;
    return {
      eligible: true,
      unitPricePerStaffMonthly: Math.max(0, unit),
      followsPlanAnnualDiscount: row.subscription_add_ons.follows_plan_annual_discount !== false,
    };
  }
  return {
    eligible: planEligibleForOmnichannelAddonDisplayLegacy(plan),
    unitPricePerStaffMonthly: OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY,
    followsPlanAnnualDiscount: true,
  };
}

/**
 * Paid HR tiers that show omnichannel add-on pricing (DB junction or legacy fallback).
 */
export function planEligibleForOmnichannelAddonDisplay(plan: PlanAddonSlice): boolean {
  return getOmnichannelRosterAddonConfig(plan).eligible;
}

export function getOmnichannelAddonMonthlyTotalIdr(
  rosterCount: number,
  unitPricePerStaffMonthly: number = OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY,
): number {
  const c = Number(rosterCount);
  const u = Number(unitPricePerStaffMonthly);
  if (!Number.isFinite(c) || c <= 0) return 0;
  if (!Number.isFinite(u) || u < 0) return 0;
  return c * u;
}

export function getOmnichannelAddonYearlyTotalIdr(
  rosterCount: number,
  annualDiscountPercent: number | null | undefined,
  unitPricePerStaffMonthly: number = OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY,
  addonFollowsPlanAnnualDiscount = true,
): number {
  const monthly = getOmnichannelAddonMonthlyTotalIdr(rosterCount, unitPricePerStaffMonthly);
  const discountSource = addonFollowsPlanAnnualDiscount ? annualDiscountPercent : 20;
  const discount =
    discountSource != null && Number.isFinite(Number(discountSource)) ? Number(discountSource) : 20;
  return monthly * 12 * (1 - discount / 100);
}

export type MidtransItemDetailLine = { id: string; name: string; price: number; quantity: number };

/**
 * Split `grossAmount` across HR vs selected catalog add-ons for Midtrans `item_details` (sums must equal gross).
 * `catalogAddOnsListAmountIdr` = list-price total of included add-ons for the same billing column as `billingCycle`.
 */
export function buildMidtransOmnichannelSplitItemDetails(params: {
  grossAmount: number;
  billingCycle: "monthly" | "yearly";
  planName: string;
  memberCount: number;
  planBasePerMember: number;
  annualDiscountPercent: number | null;
  /** Sum of selected `subscription_plan_add_ons` lines at list price (monthly or yearly). */
  catalogAddOnsListAmountIdr: number;
}): MidtransItemDetailLine[] | undefined {
  const addonsFull = Math.max(0, Math.round(Number(params.catalogAddOnsListAmountIdr)));
  if (addonsFull <= 0) return undefined;
  const gross = Math.round(Number(params.grossAmount));
  if (!Number.isFinite(gross) || gross <= 0) return undefined;

  const hrFull =
    params.billingCycle === "yearly"
      ? getYearlyPriceForMembers(params.planBasePerMember, params.memberCount, params.annualDiscountPercent)
      : getMonthlyPriceForMembers(params.planBasePerMember, params.memberCount);
  const totalFull = hrFull + addonsFull;
  if (totalFull <= 0) return undefined;

  const hrPart = Math.max(0, Math.round((gross * hrFull) / totalFull));
  const addonPart = Math.max(0, gross - hrPart);
  return [
    {
      id: "hr-seats",
      name: `HR ${params.planName} — ${params.memberCount} seat`,
      price: hrPart,
      quantity: 1,
    },
    {
      id: "catalog-addons",
      name: `Add-on — ${params.planName}`,
      price: addonPart,
      quantity: 1,
    },
  ];
}

/**
 * Midtrans `item_details` when the charged HR amount is known explicitly (e.g. prorate) and must sum with
 * catalog add-on list price to `gross_amount`. Prefer this over {@link buildMidtransOmnichannelSplitItemDetails}
 * when `grossAmount` is not the full list HR + add-ons total.
 */
export function buildMidtransExplicitHrAndAddonItemDetails(params: {
  hrChargeAmountIdr: number;
  catalogAddOnsListAmountIdr: number;
  billingCycle: "monthly" | "yearly";
  planName: string;
  memberCount: number;
}): MidtransItemDetailLine[] | undefined {
  const hr = Math.max(0, Math.round(Number(params.hrChargeAmountIdr)));
  const addons = Math.max(0, Math.round(Number(params.catalogAddOnsListAmountIdr)));
  if (addons <= 0) return undefined;
  const cycle = params.billingCycle;
  if (hr <= 0) {
    return [
      {
        id: "catalog-addons",
        name: `Add-on — ${params.planName}`,
        price: addons,
        quantity: 1,
      },
    ];
  }
  return [
    {
      id: "hr-seats",
      name: `HR ${params.planName} — ${params.memberCount} seat (${cycle})`,
      price: hr,
      quantity: 1,
    },
    {
      id: "catalog-addons",
      name: `Add-on — ${params.planName}`,
      price: addons,
      quantity: 1,
    },
  ];
}
