import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";

export interface SubscriptionStatus {
  status: "trial" | "active" | "expired" | "cancelled" | "suspended" | string;
  is_trial: boolean;
  is_active: boolean;
  is_expired: boolean;
  trial_end_date?: string;
  subscription_end_date?: string;
  subscription_start_date?: string;
  end_date?: string;
  plan_name: string;
  current_employees: number;
  employee_count?: number;
  member_count: number;
  member_limit?: number;
  over_limit: boolean;
  is_over_limit?: boolean;
  days_until_expiry: number;
  days_remaining?: number;
  needs_renewal: boolean;
  billing_cycle?: "monthly" | "yearly";
  base_price_per_member?: number;
  annual_discount_percentage?: number;
  next_payment_date?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  base_price_per_member: number;
  features: string[];
  is_active: boolean;
  is_custom: boolean;
  demo_required: boolean;
  annual_discount_percentage: number | null;
  member_discount_tiers: unknown[] | null;
  jumlah_hari_trial: number | null;
}

function parseFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === "object") return [];
  return [];
}

export function useOptimizedSubscription() {
  const { t } = useTranslation();
  const { organizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const hasInitializedRef = useRef(false);
  const lastOrgIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!organizationId) {
      queryClient.removeQueries({ queryKey: subscriptionQueryKeys.status("") });
      lastOrgIdRef.current = null;
      hasInitializedRef.current = false;
    }
  }, [organizationId, queryClient]);

  useEffect(() => {
    if (!organizationId) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (hasInitializedRef.current && lastOrgIdRef.current === organizationId) return;

    timeoutRef.current = setTimeout(() => {
      if (lastOrgIdRef.current !== organizationId) {
        const previousOrgId = lastOrgIdRef.current;
        lastOrgIdRef.current = organizationId;
        hasInitializedRef.current = true;
        if (previousOrgId) {
          queryClient.removeQueries({
            predicate: (q) => {
              const k = q.queryKey;
              return Array.isArray(k) && k[0] === "subscriptionStatus" && k[1] === previousOrgId;
            },
          });
          queryClient.invalidateQueries({
            queryKey: subscriptionQueryKeys.status(organizationId),
            refetchType: "active",
          });
        }
      }
    }, 150);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [organizationId, queryClient]);

  const {
    data: subscriptionStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: subscriptionQueryKeys.status(organizationId || ""),
    queryFn: async () => {
      if (!organizationId) throw new Error("No organization ID");
      const { data, error } = await supabase.rpc("get_subscription_status", {
        p_org_id: organizationId,
      });
      if (error) throw error;
      const raw = data as Record<string, unknown> | null;
      if (!raw) return null;

      const daysRem = Number(raw.days_remaining ?? 0);
      const mapped: SubscriptionStatus = {
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
      return mapped;
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: (failureCount, err: { status?: number }) => {
      if (err?.status >= 400 && err?.status < 500) return false;
      return failureCount < 2;
    },
  });

  const { data: subscriptionPlans, isLoading: plansLoading } = useQuery({
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
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  });

  const checkEmployeeLimitMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization ID");
      const { data, error } = await supabase.rpc("can_add_employee", { p_org_id: organizationId });
      if (error) throw error;
      return Boolean(data);
    },
    onError: () => toast.error(t("subscription.plans.hooks.employeeLimitFailed")),
  });

  const canAddEmployee = useCallback(async (): Promise<boolean> => {
    try {
      return await checkEmployeeLimitMutation.mutateAsync();
    } catch {
      return false;
    }
  }, [checkEmployeeLimitMutation]);

  const refreshSubscriptionStatus = useCallback(() => {
    if (organizationId) {
      queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.status(organizationId),
        refetchType: "active",
      });
      queryClient.invalidateQueries({ queryKey: ["payment-history", organizationId], refetchType: "active" });
      queryClient.invalidateQueries({
        queryKey: ["payment-history-next-billing", organizationId],
        refetchType: "active",
      });
    }
  }, [organizationId, queryClient]);

  const derivedState = useMemo(
    () => ({
      isLoading: statusLoading || plansLoading,
      hasActiveSubscription: subscriptionStatus?.is_active || false,
      isTrialExpired: subscriptionStatus?.is_expired && subscriptionStatus?.is_trial,
      daysLeft: subscriptionStatus?.days_until_expiry || 0,
      isOverLimit: subscriptionStatus?.over_limit || false,
    }),
    [statusLoading, plansLoading, subscriptionStatus],
  );

  return {
    subscriptionStatus,
    subscriptionPlans,
    statusLoading,
    plansLoading,
    statusError,
    canAddEmployee,
    refreshSubscriptionStatus,
    ...derivedState,
  };
}
