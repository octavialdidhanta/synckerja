import { supabase } from "@/shared/lib/supabaseClient";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";

const PLAN_ADD_ONS_SELECT =
  "*, subscription_plan_add_ons ( unit_price_override_per_month, display_order, subscription_add_ons ( code, name, default_unit_price_per_month, follows_plan_annual_discount, is_active ) )";

function parseFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normalizes Supabase nested `subscription_plan_add_ons` for `SubscriptionPlan`. */
export function mapRowToSubscriptionPlan(row: Record<string, unknown>): SubscriptionPlan {
  const rawLinks = row.subscription_plan_add_ons;
  const plan_add_ons = Array.isArray(rawLinks)
    ? rawLinks
        .map((link: Record<string, unknown>) => {
          const nested = link.subscription_add_ons as Record<string, unknown> | null | undefined;
          if (!nested || nested.is_active === false) return null;
          return {
            unit_price_override_per_month:
              link.unit_price_override_per_month == null
                ? null
                : toNum(link.unit_price_override_per_month),
            display_order: link.display_order == null ? 0 : toNum(link.display_order),
            subscription_add_ons: {
              code: String(nested.code ?? ""),
              name: String(nested.name ?? ""),
              default_unit_price_per_month: toNum(nested.default_unit_price_per_month),
              follows_plan_annual_discount:
                nested.follows_plan_annual_discount === null || nested.follows_plan_annual_discount === undefined
                  ? true
                  : Boolean(nested.follows_plan_annual_discount),
              is_active: nested.is_active !== false,
            },
          };
        })
        .filter(Boolean)
    : [];

  const { subscription_plan_add_ons: _omit, ...rest } = row;
  return {
    ...(rest as Omit<SubscriptionPlan, "features" | "plan_add_ons">),
    features: parseFeatures(row.features),
    plan_add_ons: (plan_add_ons.length ? plan_add_ons : null) as SubscriptionPlan["plan_add_ons"],
  };
}

export async function fetchSubscriptionPlansWithAddOns(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(PLAN_ADD_ONS_SELECT)
    .eq("is_active", true)
    .order("base_price_per_member", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => mapRowToSubscriptionPlan(row as Record<string, unknown>));
}

export { PLAN_ADD_ONS_SELECT };
