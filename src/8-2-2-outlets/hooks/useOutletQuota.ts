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
    const rawSalesQuota = subscriptionStatus?.sales_outlet_quota;
    const contractLocked = typeof rawSalesQuota === "number" && Number.isFinite(rawSalesQuota);
    const salesOutletQuota = contractLocked ? Math.max(0, Math.floor(rawSalesQuota)) : null;
    const maxOutlets = contractLocked
      ? salesOutletQuota!
      : isTrial
        ? HQ_INCLUDED_OUTLETS
        : HQ_INCLUDED_OUTLETS + paidExtras;
    const activeCount = rows.length;
    const canCreate = contractLocked ? activeCount < maxOutlets : !isTrial && activeCount < maxOutlets;
    return {
      isTrial,
      paidExtras,
      maxOutlets,
      activeCount,
      canCreate,
      contractLocked,
      salesOutletQuota,
      isLoading: outletsLoading || statusLoading,
    };
  }, [
    rows.length,
    outletsLoading,
    statusLoading,
    subscriptionStatus?.is_trial,
    subscriptionStatus?.pos_paid_outlet_count,
    subscriptionStatus?.sales_outlet_quota,
  ]);
}
