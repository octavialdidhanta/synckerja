import type { SubscriptionPlan, SubscriptionPlanAddOnLink } from "@/10-subscription/types/SubscriptionPlanCatalog";

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
  const base = Number(basePrice);
  const count = Number(memberCount);
  const discount =
    annualDiscountPercent != null && Number.isFinite(Number(annualDiscountPercent))
      ? Number(annualDiscountPercent)
      : 20;
  const product = (Number.isFinite(base) ? base : 0) * (Number.isFinite(count) ? count : 0) * 12;
  return product * (1 - discount / 100);
}

/** Fallback IDR per roster staff / month when DB has no `subscription_plan_add_ons` row. */
export const OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY = 125_000;

export const OMNICHANNEL_ROSTER_ADD_ON_CODE = "omnichannel_roster" as const;

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

export type OmnichannelRosterAddonResolved = {
  eligible: boolean;
  unitPricePerStaffMonthly: number;
  followsPlanAnnualDiscount: boolean;
};

type PlanAddonSlice = Pick<SubscriptionPlan, "name" | "base_price_per_member" | "plan_add_ons">;

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

export function resolvePlanAddOnUnitMonthly(link: SubscriptionPlanAddOnLink): number {
  const def = Number(link.subscription_add_ons.default_unit_price_per_month);
  const ov = link.unit_price_override_per_month;
  if (ov != null && Number.isFinite(Number(ov))) return Math.max(0, Number(ov));
  if (Number.isFinite(def)) return Math.max(0, def);
  return 0;
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

/** Merge stored UI state with defaults (current-plan omnichannel defaults from paid seat count). */
export function mergePlanAddOnSelections(
  plan: Pick<SubscriptionPlan, "plan_add_ons">,
  stored: Record<string, { included: boolean; quantity: number }> | undefined,
  isCurrentPlan: boolean,
  omnichannelPaidSeats: number,
  /** Add-on billed units cannot exceed selected HR member (seat) count. */
  maxAddonQuantityPerLine: number,
): Record<string, { included: boolean; quantity: number }> {
  const cap = Math.max(1, Math.round(Number(maxAddonQuantityPerLine)) || 1);
  const clampQty = (q: number) =>
    Math.min(cap, Math.max(1, Math.round(Number(q)) || 1));

  const out: Record<string, { included: boolean; quantity: number }> = {};
  for (const link of sortPlanAddOnLinks(plan)) {
    const code = link.subscription_add_ons.code;
    const prev = stored?.[code];
    /** Paid roster seats from DB override stale local `stored` (e.g. toggle left off after checkout). */
    if (code === OMNICHANNEL_ROSTER_ADD_ON_CODE && isCurrentPlan && omnichannelPaidSeats > 0) {
      const q = clampQty(Math.max(1, Math.round(Number(omnichannelPaidSeats)) || 1));
      out[code] = { included: true, quantity: q };
      continue;
    }
    if (prev) {
      out[code] = {
        included: Boolean(prev.included),
        quantity: clampQty(prev.quantity),
      };
      continue;
    }
    if (code === OMNICHANNEL_ROSTER_ADD_ON_CODE && isCurrentPlan) {
      const q = clampQty(Math.max(1, Math.round(Number(omnichannelPaidSeats)) || 1));
      out[code] = { included: omnichannelPaidSeats > 0, quantity: q };
    } else {
      out[code] = { included: false, quantity: 1 };
    }
  }
  return out;
}

export function sumSelectedCatalogAddOnsListAmountIdr(params: {
  plan: PlanAddonSlice;
  billingCycle: "monthly" | "yearly";
  annualDiscountPercent: number | null;
  selections: Record<string, { included: boolean; quantity: number } | undefined>;
}): number {
  const links = sortPlanAddOnLinks(params.plan);
  let sum = 0;
  for (const link of links) {
    const code = link.subscription_add_ons.code;
    const sel = params.selections[code];
    if (!sel?.included || sel.quantity < 1) continue;
    const unit = resolvePlanAddOnUnitMonthly(link);
    if (params.billingCycle === "yearly") {
      sum += computePlanAddOnLineYearlyTotalIdr(
        sel.quantity,
        unit,
        link.subscription_add_ons.follows_plan_annual_discount !== false,
        params.annualDiscountPercent,
      );
    } else {
      sum += sel.quantity * unit;
    }
  }
  return sum;
}

/** True when checkout uses time-based HR prorate from `calculate_prorate_upgrade` (not full list / skip_prorate). */
export function usesHrProrateForAddonBilling(
  calculation:
    | {
        charge_now?: boolean;
        prorate_amount?: number;
        skip_prorate?: boolean;
      }
    | null
    | undefined,
): boolean {
  if (!calculation?.charge_now) return false;
  if (calculation.skip_prorate) return false;
  const pa = Number(calculation.prorate_amount);
  return Number.isFinite(pa) && pa > 0;
}

/**
 * List-price total for **new** add-on units only (selected qty minus already-paid baseline).
 * Omnichannel baseline = `legacyOmnichannelPaidSeatCount`; other catalog lines baseline 0 until persisted per line exists.
 */
export function catalogAddOnIncrementalListAmountIdr(params: {
  plan: PlanAddonSlice;
  billingCycle: "monthly" | "yearly";
  annualDiscountPercent: number | null;
  selections: PlanAddOnSelectionMap;
  legacyOmnichannelPaidSeatCount: number;
}): number {
  const paidOmnichannel = Math.max(0, Math.round(Number(params.legacyOmnichannelPaidSeatCount)) || 0);
  const links = sortPlanAddOnLinks(params.plan);
  if (links.length > 0) {
    let sum = 0;
    for (const link of links) {
      const code = link.subscription_add_ons.code;
      const sel = params.selections[code];
      if (!sel?.included || sel.quantity < 1) continue;
      const baseline = code === OMNICHANNEL_ROSTER_ADD_ON_CODE ? paidOmnichannel : 0;
      const deltaQty = Math.max(0, Math.round(Number(sel.quantity)) - baseline);
      if (deltaQty < 1) continue;
      const unit = resolvePlanAddOnUnitMonthly(link);
      if (params.billingCycle === "yearly") {
        sum += computePlanAddOnLineYearlyTotalIdr(
          deltaQty,
          unit,
          link.subscription_add_ons.follows_plan_annual_discount !== false,
          params.annualDiscountPercent,
        );
      } else {
        sum += deltaQty * unit;
      }
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
  if (params.billingCycle === "yearly") {
    return getOmnichannelAddonYearlyTotalIdr(
      deltaQty,
      params.annualDiscountPercent,
      cfg.unitPricePerStaffMonthly,
      cfg.followsPlanAnnualDiscount,
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
  selections: PlanAddOnSelectionMap;
  legacyOmnichannelPaidSeatCount: number;
  calculation:
    | {
        charge_now?: boolean;
        prorate_amount?: number;
        skip_prorate?: boolean;
        remaining_days?: number;
      }
    | null
    | undefined;
}): number {
  if (usesHrProrateForAddonBilling(params.calculation)) {
    const inc = catalogAddOnIncrementalListAmountIdr({
      plan: params.plan,
      billingCycle: params.billingCycle,
      annualDiscountPercent: params.annualDiscountPercent,
      selections: params.selections,
      legacyOmnichannelPaidSeatCount: params.legacyOmnichannelPaidSeatCount,
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
    selections: params.selections,
    legacyOmnichannelPaidSeatCount: params.legacyOmnichannelPaidSeatCount,
  });
}

/** List-price total of add-ons for Midtrans split: selected junction rows, else legacy omnichannel-only fallback. */
export function catalogAddOnListAmountForMidtransSplit(params: {
  plan: PlanAddonSlice;
  billingCycle: "monthly" | "yearly";
  annualDiscountPercent: number | null;
  selections: Record<string, { included: boolean; quantity: number } | undefined>;
  legacyOmnichannelPaidSeatCount: number;
}): number {
  if (sortPlanAddOnLinks(params.plan).length > 0) {
    return sumSelectedCatalogAddOnsListAmountIdr({
      plan: params.plan,
      billingCycle: params.billingCycle,
      annualDiscountPercent: params.annualDiscountPercent,
      selections: params.selections,
    });
  }
  const cfg = getOmnichannelRosterAddonConfig(params.plan);
  if (!cfg.eligible || params.legacyOmnichannelPaidSeatCount <= 0) return 0;
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
