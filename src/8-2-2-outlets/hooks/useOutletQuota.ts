import { useMemo } from "react";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { usePosOutlets } from "./usePosOutlets";

const HQ_INCLUDED_OUTLETS = 1;

export function useOutletQuota() {
  const { rows, isLoading: outletsLoading } = usePosOutlets();
  const { subscriptionStatus, statusLoading } = useOptimizedSubscription({ includePlans: false });

  return useMemo(() => {
    const isTrial = Boolean(subscriptionStatus?.is_trial);
    const paidExtras = Math.max(0, Math.round(Number(subscriptionStatus?.pos_paid_outlet_count ?? 0)) || 0);
    const maxOutlets = isTrial ? HQ_INCLUDED_OUTLETS : HQ_INCLUDED_OUTLETS + paidExtras;
    const activeCount = rows.length;
    const canCreate = !isTrial && activeCount < maxOutlets;
    return {
      isTrial,
      paidExtras,
      maxOutlets,
      activeCount,
      canCreate,
      isLoading: outletsLoading || statusLoading,
    };
  }, [rows.length, outletsLoading, statusLoading, subscriptionStatus?.is_trial, subscriptionStatus?.pos_paid_outlet_count]);
}
