import { useMemo } from "react";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useOmnichannelRosterCount } from "@/shared/hooks/useOrganizationOmnichannelStaff";

/**
 * Outbound WA/IG live chat requires paid omnichannel seats and/or at least one roster agent.
 * Never treat loading / unknown subscription as "no addon" — avoids flashing the composer warning.
 */
export function useOmnichannelOutboundEntitlement() {
  const { organizationId, loading: orgLoading } = useActiveOrganization();
  const { subscriptionStatus, statusLoading: subscriptionPending } = useOptimizedSubscription({
    includePlans: false,
  });
  const { count: rosterCount, isPending: rosterPending } = useOmnichannelRosterCount();

  return useMemo(() => {
    const entitlementPending =
      orgLoading || !organizationId || subscriptionPending || rosterPending;

    const paidSeats = subscriptionStatus?.omnichannel_paid_seat_count ?? 0;
    const hasEntitlement = paidSeats >= 1 || rosterCount >= 1;

    const lacksOmnichannelEntitlement = !entitlementPending && !hasEntitlement;
    const showNoAddonWarning = lacksOmnichannelEntitlement;

    return {
      entitlementPending,
      hasEntitlement,
      lacksOmnichannelEntitlement,
      showNoAddonWarning,
      paidSeats,
      rosterCount,
    };
  }, [
    orgLoading,
    organizationId,
    subscriptionPending,
    rosterPending,
    subscriptionStatus?.omnichannel_paid_seat_count,
    rosterCount,
  ]);
}
