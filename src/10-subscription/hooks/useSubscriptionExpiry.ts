import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";

export interface SubscriptionExpiryStatus {
  isExpired: boolean;
  isTrialExpired: boolean;
  isSubscriptionExpired: boolean;
  trialEndDate: string | null;
  subscriptionEndDate: string | null;
  expiredDate: string | null;
  daysExpired: number;
  status: "active" | "expired" | "checking";
}

export function useSubscriptionExpiry() {
  const { organizationId, loading: orgLoading } = useActiveOrganization();

  const queryKey = subscriptionQueryKeys.status(organizationId || "");

  const { data: subscriptionStatus, isLoading, error } = useQuery<SubscriptionStatus | null>({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error: rpcError } = await supabase.rpc("get_subscription_status", {
        p_org_id: organizationId,
      });
      if (rpcError) {
        console.warn("get_subscription_status:", rpcError);
        return null;
      }
      const raw = data as Record<string, unknown> | null;
      if (!raw) return null;
      const daysRem = Number(raw.days_remaining ?? 0);
      return {
        status: String(raw.status || "trial"),
        plan_name: String(raw.plan_name || "Free Trial"),
        is_trial: Boolean(raw.is_trial ?? raw.status === "trial"),
        is_active: Boolean(raw.is_active),
        is_expired: Boolean(raw.is_expired),
        current_employees: Number(raw.employee_count ?? 0),
        member_count: Number(raw.member_limit ?? (raw.is_trial ? 2 : 1000)),
        over_limit: Boolean(raw.is_over_limit),
        days_until_expiry: daysRem,
        needs_renewal: daysRem <= 7,
        end_date: raw.end_date as string | undefined,
        subscription_start_date: raw.subscription_start_date as string | undefined,
        subscription_end_date: raw.subscription_end_date as string | undefined,
        trial_end_date: raw.trial_end_date as string | undefined,
        billing_cycle: (raw.billing_cycle as "monthly" | "yearly") || "monthly",
        base_price_per_member: Number(raw.base_price_per_member ?? 0),
        next_payment_date: raw.next_payment_date as string | undefined,
        employee_count: Number(raw.employee_count ?? 0),
        member_limit: Number(raw.member_limit ?? 0),
        is_over_limit: Boolean(raw.is_over_limit),
        days_remaining: daysRem,
      };
    },
    enabled: !orgLoading && !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const expiryStatus: SubscriptionExpiryStatus = useMemo(() => {
    if (!subscriptionStatus) {
      return {
        isExpired: false,
        isTrialExpired: false,
        isSubscriptionExpired: false,
        trialEndDate: null,
        subscriptionEndDate: null,
        expiredDate: null,
        daysExpired: 0,
        status: orgLoading ? "checking" : "active",
      };
    }

    const now = new Date();
    const trialEndDate = subscriptionStatus.trial_end_date ? new Date(subscriptionStatus.trial_end_date) : null;
    const subscriptionEndDate = subscriptionStatus.subscription_end_date
      ? new Date(subscriptionStatus.subscription_end_date)
      : null;

    const isTrialExpired = subscriptionStatus.is_trial && trialEndDate ? trialEndDate < now : false;
    const isSubscriptionExpired =
      !subscriptionStatus.is_trial && subscriptionEndDate ? subscriptionEndDate < now : false;
    const isExpired = subscriptionStatus.is_expired || isTrialExpired || isSubscriptionExpired;

    const expiredDate = isTrialExpired
      ? subscriptionStatus.trial_end_date
      : isSubscriptionExpired
        ? subscriptionStatus.subscription_end_date
        : null;

    let daysExpired = 0;
    if (expiredDate) {
      const expDate = new Date(expiredDate);
      daysExpired = Math.floor((now.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      isExpired,
      isTrialExpired,
      isSubscriptionExpired,
      trialEndDate: subscriptionStatus.trial_end_date || null,
      subscriptionEndDate: subscriptionStatus.subscription_end_date || null,
      expiredDate,
      daysExpired,
      status: isExpired ? "expired" : "active",
    };
  }, [subscriptionStatus, orgLoading]);

  return { expiryStatus, isLoading, error };
}
