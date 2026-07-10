import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { differenceInCalendarDays, startOfToday } from "date-fns";
import { supabase } from "@/shared/lib/supabaseClient";

/**
 * Derives next billing from payment history (display-only helpers).
 * Subscription expiry UI should use `get_subscription_status` via `useOptimizedSubscription`.
 */
export function useNextBillingFromPayments(organizationId: string | undefined) {
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payment-history-next-billing", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("id, created_at, billing_cycle, subscription_start_date, subscription_end_date, status")
        .eq("organization_id", organizationId)
        .in("status", ["success", "settlement", "paid"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    refetchOnWindowFocus: false,
  });

  const computed = useMemo(() => {
    const successful = (payments as Record<string, unknown>[]).filter((p) =>
      ["success", "settlement", "paid"].includes(String(p.status)),
    );
    if (successful.length === 0) {
      return { nextBillingDate: null as Date | null, daysUntilExpiry: 0 };
    }

    const lastPayment = successful[0];
    const endFromDb = lastPayment.subscription_end_date
      ? new Date(String(lastPayment.subscription_end_date))
      : null;
    const nextBillingDate =
      endFromDb && Number.isFinite(endFromDb.getTime()) ? endFromDb : null;

    const today = startOfToday();
    const daysUntilExpiry = nextBillingDate
      ? differenceInCalendarDays(nextBillingDate, today)
      : 0;

    return { nextBillingDate, daysUntilExpiry };
  }, [payments]);

  return { ...computed, paymentsLoading };
}
