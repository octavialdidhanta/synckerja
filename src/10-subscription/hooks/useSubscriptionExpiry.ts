import { useMemo } from "react";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { deriveSubscriptionExpiryStatus } from "@/10-subscription/shared/deriveSubscriptionExpiryStatus";

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
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const { subscriptionStatus, statusLoading, statusError } = useOptimizedSubscription({
    includePlans: false,
  });

  const expiryStatus: SubscriptionExpiryStatus = useMemo(
    () => deriveSubscriptionExpiryStatus(subscriptionStatus, orgBootstrapPending),
    [subscriptionStatus, orgBootstrapPending],
  );

  const isLoading = orgBootstrapPending || (!!organizationId && statusLoading);

  return { expiryStatus, isLoading, error: statusError, subscriptionStatus };
}
