import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import { fetchSubscriptionPlansWithAddOns } from "@/10-subscription/api/fetchSubscriptionPlansWithAddOns";

export type { SubscriptionPlan, SubscriptionPlanAddOnLink, SubscriptionAddOnNested } from "@/10-subscription/types/SubscriptionPlanCatalog";

/** RPC check without mounting subscription queries (e.g. useEmployeeCreation). */
export async function fetchCanAddEmployee(organizationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_add_employee", { p_org_id: organizationId });
  if (error) return false;
  return Boolean(data);
}

/** PostgREST may return jsonb as object or (rarely) string; RPC keys stay snake_case from SQL. */
function parseSubscriptionStatusRpcPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

function readNonNegativeInt(raw: Record<string, unknown>, keys: readonly string[]): number {
  for (const k of keys) {
    const v = raw[k];
    if (v === undefined || v === null) continue;
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

export type UseOptimizedSubscriptionOptions = {
  /** When false, skips subscription_plans query (saves fetch on pages that only need status). */
  includePlans?: boolean;
};

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
  /** Purchased omnichannel roster seat entitlement (DB). */
  omnichannel_paid_seat_count?: number;
  /** Cap for roster rows = min(HR member_limit, paid omnichannel seats). */
  omnichannel_roster_seat_cap?: number;
}

export function useOptimizedSubscription(options?: UseOptimizedSubscriptionOptions) {
  const includePlans = options?.includePlans ?? true;
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
    isFetching: statusFetching,
    error: statusError,
  } = useQuery({
    queryKey: subscriptionQueryKeys.status(organizationId || ""),
    queryFn: async () => {
      if (!organizationId) throw new Error("No organization ID");
      const [{ data, error }, osRes] = await Promise.all([
        supabase.rpc("get_subscription_status", {
          p_org_id: organizationId,
        }),
        supabase
          .from("organization_subscriptions")
          .select("omnichannel_paid_seat_count, member_count")
          .eq("organization_id", organizationId)
          .maybeSingle(),
      ]);
      if (error) throw error;
      const raw = parseSubscriptionStatusRpcPayload(data);
      if (!raw) return null;

      /** RPC bisa tidak menyertakan / mengisi omnichannel; baris tabel bisa tertunda RLS. Ambil nilai terbesar yang masuk akal. */
      if (osRes.error) {
        console.warn("organization_subscriptions omnichannel merge:", osRes.error.message);
      }
      const rpcPaid = readNonNegativeInt(raw, ["omnichannel_paid_seat_count", "omnichannelPaidSeatCount"]);
      const tablePaid =
        osRes.data?.omnichannel_paid_seat_count !== undefined &&
        osRes.data?.omnichannel_paid_seat_count !== null
          ? Number(osRes.data.omnichannel_paid_seat_count)
          : NaN;
      const paidOmni = Number.isFinite(tablePaid)
        ? Math.max(0, tablePaid, rpcPaid)
        : Math.max(0, rpcPaid);

      const memberFromTable = osRes.data?.member_count;
      const memberLimRpc = Number(raw.member_limit ?? (raw.is_trial ? 2 : 1000));
      const memberLim =
        memberFromTable !== undefined && memberFromTable !== null
          ? Number(memberFromTable)
          : memberLimRpc;
      const rosterCap = Math.min(memberLim, paidOmni);

      const daysRem = Number(raw.days_remaining ?? 0);
      const mapped: SubscriptionStatus = {
        status: String(raw.status || "trial"),
        plan_name: String(raw.plan_name || "Free Trial"),
        is_trial: Boolean(raw.is_trial ?? raw.status === "trial"),
        is_active: Boolean(raw.is_active),
        is_expired: Boolean(raw.is_expired),
        current_employees: Number(raw.employee_count ?? 0),
        member_count: memberLim,
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
        member_limit: memberLim,
        is_over_limit: Boolean(raw.is_over_limit),
        days_remaining: daysRem,
        omnichannel_paid_seat_count: paidOmni,
        omnichannel_roster_seat_cap: rosterCap,
      };
      return mapped;
    },
    enabled: !!organizationId,
    /** Keep omnichannel seat counts aligned across `/subscription/plans` and `/omnichannel/settings` when navigating. */
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: (failureCount, err: { status?: number }) => {
      if (err?.status >= 400 && err?.status < 500) return false;
      return failureCount < 2;
    },
  });

  const { data: subscriptionPlans, isLoading: plansLoading } = useQuery({
    queryKey: subscriptionQueryKeys.plans,
    queryFn: fetchSubscriptionPlansWithAddOns,
    enabled: includePlans,
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
      isLoading: statusLoading || (includePlans ? plansLoading : false),
      hasActiveSubscription: subscriptionStatus?.is_active || false,
      isTrialExpired: subscriptionStatus?.is_expired && subscriptionStatus?.is_trial,
      daysLeft: subscriptionStatus?.days_until_expiry || 0,
      isOverLimit: subscriptionStatus?.over_limit || false,
    }),
    [statusLoading, plansLoading, subscriptionStatus, includePlans],
  );

  return {
    subscriptionStatus,
    subscriptionPlans,
    statusFetching,
    statusLoading,
    plansLoading,
    statusError,
    canAddEmployee,
    refreshSubscriptionStatus,
    ...derivedState,
  };
}
