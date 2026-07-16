import {
  resolvePlanModuleAccessForDisplay,
} from "@/10-subscription/shared/planModuleDisplay";
import { sortSubscriptionPlansForDisplay } from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";
import type { ModuleAccessMap } from "@/shared/auth/module-access/moduleCatalog";
import { supabase } from "@/shared/lib/supabaseClient";

const PLAN_ADD_ONS_SELECT =
  "*, subscription_plan_add_ons ( unit_price_override_per_month, display_order, subscription_add_ons ( code, name, billing_unit, default_unit_price_per_month, follows_plan_annual_discount, is_active ) )";

function parseFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toMaxMembers(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

type PlanModuleAccessRow = {
  subscription_plan_id: string;
  module_key: string;
  is_enabled: boolean;
};

function groupModuleRowsByPlanId(rows: PlanModuleAccessRow[]): Map<string, PlanModuleAccessRow[]> {
  const grouped = new Map<string, PlanModuleAccessRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.subscription_plan_id) ?? [];
    list.push(row);
    grouped.set(row.subscription_plan_id, list);
  }
  return grouped;
}

/** Normalizes Supabase nested `subscription_plan_add_ons` for `SubscriptionPlan`. */
export function mapRowToSubscriptionPlan(
  row: Record<string, unknown>,
  planModuleAccess?: ModuleAccessMap,
): SubscriptionPlan {
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
              billing_unit:
                nested.billing_unit == null || nested.billing_unit === undefined
                  ? null
                  : String(nested.billing_unit),
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

  const features = parseFeatures(row.features);
  const { subscription_plan_add_ons: _omit, max_members: _rawMax, ...rest } = row;
  return {
    ...(rest as Omit<SubscriptionPlan, "features" | "plan_add_ons" | "max_members" | "plan_module_access">),
    max_members: toMaxMembers(row.max_members),
    features,
    plan_add_ons: (plan_add_ons.length ? plan_add_ons : null) as SubscriptionPlan["plan_add_ons"],
    plan_module_access: planModuleAccess,
  };
}

export async function fetchSubscriptionPlansWithAddOns(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(PLAN_ADD_ONS_SELECT)
    .eq("is_active", true)
    .order("base_price_per_member", { ascending: true });

  if (error) throw error;

  const rows = (data || []).map((row) => row as Record<string, unknown>);
  const planIds = rows.map((row) => String(row.id));

  let moduleRows: PlanModuleAccessRow[] = [];
  if (planIds.length > 0) {
    const { data: moduleData, error: moduleError } = await supabase
      .from("subscription_plan_module_access")
      .select("subscription_plan_id, module_key, is_enabled")
      .in("subscription_plan_id", planIds);

    if (moduleError) throw moduleError;
    moduleRows = (moduleData ?? []) as PlanModuleAccessRow[];
  }

  const modulesByPlan = groupModuleRowsByPlanId(moduleRows);

  return sortSubscriptionPlansForDisplay(
    rows.map((row) => {
      const planId = String(row.id);
      const features = parseFeatures(row.features);
      const planModuleAccess = resolvePlanModuleAccessForDisplay(
        features,
        modulesByPlan.get(planId) ?? null,
      );
      return mapRowToSubscriptionPlan(row, planModuleAccess);
    }),
  );
}

export { PLAN_ADD_ONS_SELECT };
