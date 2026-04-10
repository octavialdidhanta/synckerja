import { SalesOperationsSeamlessSubpageLayout } from "@/5-2-activities/layout/SalesOperationsSeamlessSubpageLayout";
import { ClientVisitsPageContent } from "../components/ClientVisitsPageContent";
import { ClientVisitsPageSkeleton } from "../skeletons/ClientVisitsPageSkeleton";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useClientVisits } from "@/shared/hooks/organized/sales";
import { useAvailableEmployees } from "@/shared/hooks/useAvailableEmployees";
import { useClientVisitsPageSkeletonGate } from "../hooks/useClientVisitsPageSkeletonGate";

export type ClientVisitsScreenProps = {
  withSalesLayout?: boolean;
};

/**
 * Client visits: gate + konten; layout sales opsional.
 */
export function ClientVisitsScreen({ withSalesLayout = false }: ClientVisitsScreenProps) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { loading: visitsInitialLoading } = useClientVisits();
  const { isLoading: employeesInitialLoading } = useAvailableEmployees();

  const hasOrg = Boolean(organizationId);
  const rawPending = orgLoading || (hasOrg && (visitsInitialLoading || employeesInitialLoading));
  const showSkeleton = useClientVisitsPageSkeletonGate(rawPending);

  if (showSkeleton) {
    return <ClientVisitsPageSkeleton />;
  }

  const content = <ClientVisitsPageContent />;
  if (withSalesLayout) {
    return <SalesOperationsSeamlessSubpageLayout>{content}</SalesOperationsSeamlessSubpageLayout>;
  }
  return content;
}
