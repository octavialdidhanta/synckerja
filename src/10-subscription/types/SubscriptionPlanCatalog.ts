/** Active `subscription_plans` row + nested add-on links from DB. */

export type SubscriptionAddOnNested = {
  code: string;
  name: string;
  default_unit_price_per_month: number;
  follows_plan_annual_discount: boolean;
  is_active: boolean;
};

export type SubscriptionPlanAddOnLink = {
  unit_price_override_per_month: number | null;
  display_order: number;
  subscription_add_ons: SubscriptionAddOnNested;
};

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  base_price_per_member: number;
  features: string[];
  is_active: boolean;
  is_custom: boolean;
  demo_required: boolean;
  annual_discount_percentage: number | null;
  member_discount_tiers: unknown[] | null;
  jumlah_hari_trial: number | null;
  /** From `subscription_plan_add_ons` join; empty = use legacy client eligibility + default price. */
  plan_add_ons?: SubscriptionPlanAddOnLink[] | null;
}
