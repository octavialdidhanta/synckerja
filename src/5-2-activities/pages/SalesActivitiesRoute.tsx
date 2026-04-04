import { SalesOperationsSeamlessSubpageLayout } from "../layout/SalesOperationsSeamlessSubpageLayout";
import { SalesActivitiesPageContent } from "../components/SalesActivitiesPageContent";
import { SalesActivitiesPageSkeleton } from "../skeletons/SalesActivitiesPageSkeleton";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useSalesActivities } from "@/shared/hooks/organized/sales";
import { useSalesActivitiesPageSkeletonGate } from "../hooks/useSalesActivitiesPageSkeletonGate";

/**
 * Same shell as jadwal-kunjungan / client-visits: `SalesOperationsSeamlessSubpageLayout`
 * (single hidden-scrollbar scrollport inside the module).
 */
export function SalesActivitiesRoute() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { loading: activitiesInitialLoading } = useSalesActivities();

  const hasOrg = Boolean(organizationId);
  const rawPending = orgLoading || (hasOrg && activitiesInitialLoading);
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
