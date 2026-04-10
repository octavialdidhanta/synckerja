import { SalesOperationsSeamlessSubpageLayout } from "@/5-2-activities/layout/SalesOperationsSeamlessSubpageLayout";
import { VisitSchedulingPageContent } from "../components/VisitSchedulingPageContent";
import { VisitSchedulingPageSkeleton } from "../skeletons/VisitSchedulingPageSkeleton";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useVisitScheduling } from "@/shared/hooks/organized/sales";
import { useAvailableEmployees } from "@/shared/hooks/useAvailableEmployees";
import { useVisitSchedulingPageSkeletonGate } from "../hooks/useVisitSchedulingPageSkeletonGate";

export type VisitSchedulingScreenProps = {
  /** Desktop route membungkus konten dengan layout sales; mobile hanya konten untuk shell sendiri. */
  withSalesLayout?: boolean;
};

/**
 * Jadwal kunjungan: gate + konten; layout sales opsional.
 */
export function VisitSchedulingScreen({ withSalesLayout = false }: VisitSchedulingScreenProps) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { loading: visitsInitialLoading } = useVisitScheduling();
  const { isPending: employeesInitialLoading } = useAvailableEmployees();

  const hasOrg = Boolean(organizationId);
  const rawPending = orgLoading || (hasOrg && (visitsInitialLoading || employeesInitialLoading));
  const showSkeleton = useVisitSchedulingPageSkeletonGate(rawPending);

  if (showSkeleton) {
    return <VisitSchedulingPageSkeleton />;
  }

  const content = <VisitSchedulingPageContent />;
  if (withSalesLayout) {
    return <SalesOperationsSeamlessSubpageLayout>{content}</SalesOperationsSeamlessSubpageLayout>;
  }
  return content;
}
