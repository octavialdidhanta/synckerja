/** Row from `subscription_plans` (onboarding / billing). */
export type SubscriptionPlanRow = {
  id: string;
  name: string;
  description: string | null;
  base_price_per_member: number;
  features: unknown;
  is_active: boolean;
  is_custom: boolean;
  demo_required: boolean;
  annual_discount_percentage: number | null;
  member_discount_tiers: unknown;
  jumlah_hari_trial: number | null;
};
