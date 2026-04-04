import { SalesOperationsSeamlessSubpageLayout } from "@/5-2-activities/layout/SalesOperationsSeamlessSubpageLayout";
import { VisitSchedulingPageContent } from "../components/VisitSchedulingPageContent";
import { VisitSchedulingPageSkeleton } from "../skeletons/VisitSchedulingPageSkeleton";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useVisitScheduling } from "@/shared/hooks/organized/sales";
import { useAvailableEmployees } from "@/shared/hooks/useAvailableEmployees";
import { useVisitSchedulingPageSkeletonGate } from "../hooks/useVisitSchedulingPageSkeletonGate";

/**
 * Satu gate untuk jadwal kunjungan: org bootstrap + fetch pertama visits + employees (filter).
 */
export function VisitSchedulingRoute() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { loading: visitsInitialLoading } = useVisitScheduling();
  const { isPending: employeesInitialLoading } = useAvailableEmployees();

  const hasOrg = Boolean(organizationId);
  const rawPending = orgLoading || (hasOrg && (visitsInitialLoading || employeesInitialLoading));
  const showSkeleton = useVisitSchedulingPageSkeletonGate(rawPending);

  if (showSkeleton) {
    return <VisitSchedulingPageSkeleton />;
  }

  return (
    <SalesOperationsSeamlessSubpageLayout>
      <VisitSchedulingPageContent />
    </SalesOperationsSeamlessSubpageLayout>
  );
}
