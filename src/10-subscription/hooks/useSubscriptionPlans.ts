import { useQuery } from "@tanstack/react-query";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import { fetchSubscriptionPlansWithAddOns } from "@/10-subscription/api/fetchSubscriptionPlansWithAddOns";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: subscriptionQueryKeys.plans,
    queryFn: fetchSubscriptionPlansWithAddOns,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });
}
