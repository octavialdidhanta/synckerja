import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import type { SubscriptionPlan } from "@/10-subscription/hooks/useOptimizedSubscription";

function parseFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: subscriptionQueryKeys.plans,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("base_price_per_member", { ascending: true });
      if (error) throw error;
      return (data || []).map((row: Record<string, unknown>) => ({
        ...row,
        features: parseFeatures(row.features),
      })) as SubscriptionPlan[];
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });
}
