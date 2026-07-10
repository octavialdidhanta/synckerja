import { useMemo } from "react";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useSubscriptionSelfServiceEnabled } from "@/shared/auth/hooks/useSubscriptionSelfServiceEnabled";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { deriveSubscriptionExpiryStatus } from "@/10-subscription/shared/deriveSubscriptionExpiryStatus";
import {
  canManageSubscriptionRole,
  shouldShowExpiryBanner,
} from "@/10-subscription/shared/subscriptionExpiryPolicy";

export function useSubscriptionExpiryBanner() {
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const selfServiceEnabled = useSubscriptionSelfServiceEnabled();
  const { subscriptionStatus, statusLoading, statusError } = useOptimizedSubscription({
    includePlans: false,
  });
  const { data: orgData, isLoading: orgMembershipLoading } = useUserOrganizations();

  const expiryStatus = useMemo(
    () => deriveSubscriptionExpiryStatus(subscriptionStatus, orgBootstrapPending),
    [subscriptionStatus, orgBootstrapPending],
  );

  const activeMembership = useMemo(() => {
    const activeId = orgData?.activeOrganizationId;
    if (!activeId) return undefined;
    return orgData?.memberships.find((m) => m.organizationId === activeId);
  }, [orgData]);

  const canRenew = canManageSubscriptionRole(activeMembership?.role);

  const isLoading =
    orgBootstrapPending || !organizationId || statusLoading || orgMembershipLoading;

  const visible =
    selfServiceEnabled &&
    !isLoading &&
    !statusError &&
    !!subscriptionStatus &&
    shouldShowExpiryBanner(subscriptionStatus, expiryStatus);

  return {
    visible,
    subscriptionStatus,
    expiryStatus,
    canRenew,
    isLoading,
  };
}
