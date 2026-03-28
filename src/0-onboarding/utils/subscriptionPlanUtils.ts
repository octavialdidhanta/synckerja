import type { SubscriptionPlanRow } from "@/0-onboarding/types/subscriptionPlan";

export function parseFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

export function planSelectable(p: SubscriptionPlanRow): boolean {
  return p.is_active && !p.demo_required && !p.is_custom;
}

const MEMBER_LIMIT_RE = /(\d+)\s*(employee\s*limit|karyawan|orang|employees?|members?|anggota)/i;
const HINGGA_RE = /hingga\s*(\d+)/i;

/**
 * Parse max member / seat count from localized feature strings.
 * Falls back to 100 when no match (same idea as legacy CreatePlan reference).
 */
export function getEmployeeLimitFromFeatures(features: string[]): number {
  if (!features?.length) return 100;
  for (const feature of features) {
    const hingga = feature.match(HINGGA_RE);
    if (hingga) return Math.max(1, parseInt(hingga[1], 10));
    const match = feature.match(MEMBER_LIMIT_RE);
    if (match) return Math.max(1, parseInt(match[1], 10));
  }
  return 100;
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

export function sliderMaxMembers(p: SubscriptionPlanRow, kind: OnboardingPlanKind): number {
  const features = parseFeatures(p.features);
  if (kind === "paid_requires_billing") return 100;
  return getEmployeeLimitFromFeatures(features);
}

/** Default seat count: min(5, cap) for trial/free; min(5, 100) for paid display. */
export function defaultMemberCountForKind(kind: OnboardingPlanKind, maxMembers: number): number {
  const cap = kind === "paid_requires_billing" ? 100 : maxMembers;
  return Math.min(5, Math.max(1, cap));
}
