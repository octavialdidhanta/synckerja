import { SalesOperationsSeamlessSubpageLayout } from "@/5-2-activities/layout/SalesOperationsSeamlessSubpageLayout";
import { ClientVisitsPageContent } from "../components/ClientVisitsPageContent";
import { ClientVisitsPageSkeleton } from "../skeletons/ClientVisitsPageSkeleton";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useClientVisits } from "@/shared/hooks/organized/sales";
import { useAvailableEmployees } from "@/shared/hooks/useAvailableEmployees";
import { useClientVisitsPageSkeletonGate } from "../hooks/useClientVisitsPageSkeletonGate";

/**
 * Same shell as `/operations/sales/jadwal-kunjungan`: `SalesOperationsSeamlessSubpageLayout`
 * (single hidden-scrollbar scrollport — not AppShell + page double scroll).
 */
export function ClientVisitsRoute() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { loading: visitsInitialLoading } = useClientVisits();
  const { isLoading: employeesInitialLoading } = useAvailableEmployees();

  const hasOrg = Boolean(organizationId);
  const rawPending = orgLoading || (hasOrg && (visitsInitialLoading || employeesInitialLoading));
  const showSkeleton = useClientVisitsPageSkeletonGate(rawPending);

  if (showSkeleton) {
    return <ClientVisitsPageSkeleton />;
  }

  return (
    <SalesOperationsSeamlessSubpageLayout>
      <ClientVisitsPageContent />
    </SalesOperationsSeamlessSubpageLayout>
  );
}
