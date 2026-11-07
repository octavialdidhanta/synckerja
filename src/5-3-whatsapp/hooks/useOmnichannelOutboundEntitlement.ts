import { useMemo } from "react";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useOmnichannelRosterCount } from "@/shared/hooks/useOrganizationOmnichannelStaff";

/**
 * Paid omnichannel seats are required only when the org can manage its own
 * subscription ("Akses halaman subscription mandiri"). Sales tenants
 * (subscription_self_service_enabled = false) can reply without the add-on.
 * Never treat loading / unknown subscription as "no addon".
 */
export function useOmnichannelOutboundEntitlement() {
  const { organizationId, loading: orgLoading } = useActiveOrganization();
  const { organization } = useCentralizedUserData();
  const { subscriptionStatus, statusLoading: subscriptionPending } = useOptimizedSubscription({
    includePlans: false,
  });
  const { count: rosterCount, isPending: rosterPending } = useOmnichannelRosterCount();

  return useMemo(() => {
    const orgReady =
      !orgLoading &&
      Boolean(organizationId) &&
      organization?.id === organizationId;
    const salesManaged = orgReady && organization?.subscription_self_service_enabled === false;
    const entitlementPending =
      !orgReady || (!salesManaged && (subscriptionPending || rosterPending));

    const paidSeats = subscriptionStatus?.omnichannel_paid_seat_count ?? 0;
    const hasEntitlement = salesManaged || paidSeats >= 1 || rosterCount >= 1;

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
    organization?.id,
    organization?.subscription_self_service_enabled,
    subscriptionPending,
    rosterPending,
    subscriptionStatus?.omnichannel_paid_seat_count,
    rosterCount,
  ]);
}
