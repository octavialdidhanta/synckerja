import {
  ENTERPRISE_SLIDER_MAX_MEMBERS,
  isEnterpriseSubscriptionPlan,
} from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlanRow } from "@/0-onboarding/types/subscriptionPlan";

/** Default slider cap for paid per-member plans when CMS leaves max_members NULL. */
export const DEFAULT_PAID_PLAN_MAX_MEMBERS = 100;

export function parseFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

export function planSelectable(p: SubscriptionPlanRow): boolean {
  return p.is_active && !p.demo_required && !p.is_custom;
}

const MEMBER_LIMIT_RE = /(\d+)\s*(employee\s*limit|karyawan|orang|employees?|members?|anggota)/i;
const HINGGA_RE = /hingga\s*(\d+)/i;
const MEMBER_ALLOWED_RE = /^(\d+)\s*Member\s*Allowed$/i;
const PER_MEMBER_PRICE_RE = /per member\s*\/\s*bulan/i;
const DASHBOARD_FEATURE_RE = /^Dashboard\s+selalu\s+aktif$/i;

export function isZeroPricePlan(plan: { base_price_per_member?: number }): boolean {
  return Number(plan.base_price_per_member ?? 0) === 0;
}

export function planUsesPerMemberPricing(plan: { base_price_per_member?: number }): boolean {
  return Number(plan.base_price_per_member ?? 0) > 0;
}

/** Paid per-member plans show slider-driven "N Member Allowed" in plan cards. */
export function shouldShowDynamicMemberAllowed(plan: { base_price_per_member?: number }): boolean {
  return planUsesPerMemberPricing(plan);
}

/** Shorten CMS feature labels for subscription/onboarding cards. */
export function normalizePlanFeatureLabelForDisplay(feature: string): string {
  if (DASHBOARD_FEATURE_RE.test(feature.trim())) return "Dashboard";
  return feature;
}

/** CMS-generated price line — shown in plan header/breakdown, not in feature bullets. */
export function isPerMemberPriceFeatureLine(feature: string): boolean {
  return PER_MEMBER_PRICE_RE.test(feature.trim());
}

/** Feature lines that describe a fixed seat cap (not used for paid per-member plans in UI). */
export function isMemberCapFeatureLine(feature: string): boolean {
  const trimmed = feature.trim();
  if (MEMBER_ALLOWED_RE.test(trimmed)) return true;
  if (HINGGA_RE.test(trimmed)) return true;
  return MEMBER_LIMIT_RE.test(trimmed);
}

/** Filter feature bullets for subscription/onboarding plan cards. */
export function filterPlanFeaturesForDisplay(
  features: string[],
  plan: { base_price_per_member?: number },
): string[] {
  return features
    .filter((feature) => {
      if (isPerMemberPriceFeatureLine(feature)) return false;
      if (planUsesPerMemberPricing(plan) && isMemberCapFeatureLine(feature)) return false;
      return true;
    })
    .map(normalizePlanFeatureLabelForDisplay);
}

/**
 * Parse max member / seat count from localized feature strings.
 * Falls back to 100 when no match (same idea as legacy CreatePlan reference).
 */
export function getEmployeeLimitFromFeatures(features: string[]): number {
  if (!features?.length) return DEFAULT_PAID_PLAN_MAX_MEMBERS;
  for (const feature of features) {
    const hingga = feature.match(HINGGA_RE);
    if (hingga) return Math.max(1, parseInt(hingga[1], 10));
    const match = feature.match(MEMBER_LIMIT_RE);
    if (match) return Math.max(1, parseInt(match[1], 10));
  }
  return DEFAULT_PAID_PLAN_MAX_MEMBERS;
}

/** Prefer structured `max_members`; paid plans without cap default to 100 seats in office. */
export function getPlanMaxMembers(plan: {
  name?: string;
  is_custom?: boolean;
  max_members?: number | null;
  features: unknown;
  base_price_per_member?: number;
  jumlah_hari_trial?: number | null;
}): number {
  if (
    isEnterpriseSubscriptionPlan({
      name: plan.name ?? "",
      is_custom: plan.is_custom,
    })
  ) {
    return ENTERPRISE_SLIDER_MAX_MEMBERS;
  }

  const price = plan.base_price_per_member != null ? Number(plan.base_price_per_member) : 0;
  const isPaidPerMember = price > 0;

  if (plan.max_members != null && plan.max_members >= 1) {
    return plan.max_members;
  }

  if (isPaidPerMember) {
    return DEFAULT_PAID_PLAN_MAX_MEMBERS;
  }

  const fromFeatures = getEmployeeLimitFromFeatures(parseFeatures(plan.features));
  if (fromFeatures !== DEFAULT_PAID_PLAN_MAX_MEMBERS) return fromFeatures;
  if (plan.jumlah_hari_trial != null && plan.jumlah_hari_trial > 0) return 1;
  return 1;
}

export type OnboardingPlanKind = "scheduled_trial" | "free_forever" | "paid_requires_billing";

export function classifyOnboardingPlan(p: SubscriptionPlanRow): OnboardingPlanKind {
  const hasScheduledTrial = p.jumlah_hari_trial != null && p.jumlah_hari_trial > 0;
  if (hasScheduledTrial) return "scheduled_trial";

  const nameFree = /\bfree\b/i.test(p.name);
  const zeroPrice = Number(p.base_price_per_member) === 0;
  if (zeroPrice || nameFree) return "free_forever";

  return "paid_requires_billing";
}

/** User can finish onboarding without Midtrans (trial or free-forever). */
export function onboardingCanSubscribeWithoutPayment(p: SubscriptionPlanRow): boolean {
  const k = classifyOnboardingPlan(p);
  return k === "scheduled_trial" || k === "free_forever";
}

export function sliderMaxMembers(p: SubscriptionPlanRow, _kind: OnboardingPlanKind): number {
  return getPlanMaxMembers(p);
}

/** Default seat count: min(5, plan cap). */
export function defaultMemberCountForKind(_kind: OnboardingPlanKind, maxMembers: number): number {
  return Math.min(5, Math.max(1, maxMembers));
}

/** Slider max for subscription UI — grandfather subscribed seats above plan cap. */
export function resolvePlanSliderMax(planCap: number, subscribedSeats: number): number {
  return Math.max(planCap, Math.max(0, subscribedSeats));
}

type FreePlanCapSlice = {
  name?: string;
  is_custom?: boolean;
  base_price_per_member?: number;
  max_members?: number | null;
  features: unknown;
  jumlah_hari_trial?: number | null;
};

/** Rp-0 trial/free tiers that set the paid-plan member floor — excludes Enterprise (sales-led). */
export function isFreeTierPlanForMemberFloor(plan: {
  name?: string;
  is_custom?: boolean;
  base_price_per_member?: number;
}): boolean {
  if (
    isEnterpriseSubscriptionPlan({
      name: plan.name ?? "",
      is_custom: plan.is_custom,
    })
  ) {
    return false;
  }
  return isZeroPricePlan(plan);
}

/** MAX seat cap across trial/free Rp-0 plans; falls back to 1 if none. */
export function resolveFreePlanMaxMembers(plans: FreePlanCapSlice[]): number {
  const freePlans = plans.filter(isFreeTierPlanForMemberFloor);
  if (!freePlans.length) return 1;
  return Math.max(1, ...freePlans.map((p) => getPlanMaxMembers(p)));
}

export function resolvePaidPlanMemberFloor(freeMax: number): number {
  return Math.max(1, freeMax) + 1;
}

/** Slider min for paid per-member plans. */
export function resolvePaidPlanSliderMin(params: {
  paidMemberFloor: number;
  isCurrentPlan?: boolean;
  isMidCycleActive?: boolean;
  subscribedMemberCount?: number;
}): number {
  const floor = Math.max(1, params.paidMemberFloor);
  if (params.isCurrentPlan && params.isMidCycleActive) {
    const subscribed = Math.max(0, params.subscribedMemberCount ?? 0);
    return Math.max(floor, subscribed);
  }
  return floor;
}

/** Default seat for paid plan cards: prefer 5 but never below floor. */
export function defaultPaidPlanMemberCount(
  paidMemberFloor: number,
  planMax = DEFAULT_PAID_PLAN_MAX_MEMBERS,
): number {
  const cap = Math.max(1, planMax);
  return Math.max(paidMemberFloor, Math.min(5, cap));
}
