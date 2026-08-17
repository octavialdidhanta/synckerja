import { SalesOperationsSeamlessSubpageLayout } from '@/5-2-activities/layout/SalesOperationsSeamlessSubpageLayout';
import { CustomerVisitsPageContent } from '../components/CustomerVisitsPageContent';
import { CustomerVisitsPageSkeleton } from '../skeletons/CustomerVisitsPageSkeleton';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useCustomerVisitDirectory } from '../hooks/useCustomerVisitDirectory';
import { useCustomerVisits } from '../hooks/useCustomerVisits';
import { useCustomerVisitsPageSkeletonGate } from '../hooks/useCustomerVisitsPageSkeletonGate';

export function CustomerVisitsScreen() {
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const { loading: visitsLoading } = useCustomerVisits();
  const directory = useCustomerVisitDirectory();

  const hasOrg = Boolean(organizationId);
  const rawPending =
    orgBootstrapPending || (hasOrg && (visitsLoading || directory.isLoading));
  const showSkeleton = useCustomerVisitsPageSkeletonGate(rawPending);

  if (showSkeleton) {
    return <CustomerVisitsPageSkeleton />;
  }

  return (
    <SalesOperationsSeamlessSubpageLayout>
      <CustomerVisitsPageContent />
    </SalesOperationsSeamlessSubpageLayout>
  );
}
