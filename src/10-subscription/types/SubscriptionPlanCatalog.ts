/** Active `subscription_plans` row + nested add-on links from DB. */

import type { ModuleAccessMap } from "@/shared/auth/module-access/moduleCatalog";
import type { BillingTermDiscounts } from "@/10-subscription/shared/billingTermUtils";

export type SubscriptionAddOnNested = {
  code: string;
  name: string;
  default_unit_price_per_month: number;
  follows_plan_annual_discount: boolean;
  is_active: boolean;
  billing_unit?: string | null;
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
  billing_term_discounts?: BillingTermDiscounts | null;
  member_discount_tiers: unknown[] | null;
  jumlah_hari_trial: number | null;
  max_members: number | null;
  /** Per-plan module toggles from `subscription_plan_module_access` (mandiri catalog). */
  plan_module_access?: ModuleAccessMap;
  /** From `subscription_plan_add_ons` join; empty = use legacy client eligibility + default price. */
  plan_add_ons?: SubscriptionPlanAddOnLink[] | null;
}
