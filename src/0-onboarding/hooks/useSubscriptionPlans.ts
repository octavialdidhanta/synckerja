import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { SubscriptionPlanRow } from "@/0-onboarding/types/subscriptionPlan";

const PLANS_QUERY_KEY = ["subscription_plans", "active_onboarding"] as const;

async function fetchActivePlans(): Promise<SubscriptionPlanRow[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(
      "id, name, description, base_price_per_member, features, is_active, is_custom, demo_required, annual_discount_percentage, member_discount_tiers, jumlah_hari_trial",
    )
    .eq("is_active", true)
    .order("base_price_per_member", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SubscriptionPlanRow[];
}

export function useSubscriptionPlans(enabled: boolean) {
  return useQuery({
    queryKey: PLANS_QUERY_KEY,
    queryFn: fetchActivePlans,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}
