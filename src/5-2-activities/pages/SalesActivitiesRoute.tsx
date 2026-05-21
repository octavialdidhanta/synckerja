import { SalesOperationsSeamlessSubpageLayout } from "../layout/SalesOperationsSeamlessSubpageLayout";
import { SalesActivitiesPageContent } from "../components/SalesActivitiesPageContent";
import { SalesActivitiesPageSkeleton } from "../skeletons/SalesActivitiesPageSkeleton";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useSalesActivities } from "@/shared/hooks/organized/sales";
import { useSalesActivitiesPageSkeletonGate } from "../hooks/useSalesActivitiesPageSkeletonGate";

/**
 * Same shell as jadwal-kunjungan / client-visits: `SalesOperationsSeamlessSubpageLayout`
 * (single hidden-scrollbar scrollport inside the module).
 */
export function SalesActivitiesRoute() {
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const { loading: activitiesInitialLoading } = useSalesActivities();

  const hasOrg = Boolean(organizationId);
  const rawPending = orgBootstrapPending || (hasOrg && activitiesInitialLoading);
  const showSkeleton = useSalesActivitiesPageSkeletonGate(rawPending);

  if (showSkeleton) {
    return <SalesActivitiesPageSkeleton />;
  }

  return (
    <SalesOperationsSeamlessSubpageLayout>
      <SalesActivitiesPageContent />
    </SalesOperationsSeamlessSubpageLayout>
  );
}
