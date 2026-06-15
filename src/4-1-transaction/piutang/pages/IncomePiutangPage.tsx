import { IncomePiutangContentSkeleton } from '../skeletons/IncomePiutangContentSkeleton';
import { PiutangFilters } from '../components/PiutangFilters';
import { useIncomePiutangPage } from '../hooks/useIncomePiutangPage';
import { IncomePiutangPageContent } from './IncomePiutangPageContent';

export function IncomePiutangPage() {
  const piutang = useIncomePiutangPage();

  if (!piutang.showContent) {
    return <IncomePiutangContentSkeleton />;
  }

  return (
    <IncomePiutangPageContent
      filterBar={
        <div className="rounded-md border border-border bg-card p-2">
          <PiutangFilters
            search={piutang.search}
            status={piutang.status}
            verification={piutang.verificationFilter}
            onSearchChange={piutang.setSearch}
            onStatusChange={piutang.setStatus}
            onVerificationChange={piutang.setVerificationFilter}
            onClearFilters={piutang.handleClearFilters}
          />
        </div>
      }
      filteredRows={piutang.filteredRows}
      verificationAggregateByActivity={piutang.verificationAggregateByActivity}
      verificationLoading={piutang.verificationLoading}
      totalPiutangActivities={piutang.totalPiutangActivities}
      openDrawer={piutang.openDrawer}
      openVaDrawer={piutang.openVaDrawer}
      drawerOpen={piutang.drawerOpen}
      mountDrawer={piutang.mountDrawer}
      drawerActivity={piutang.drawerActivity}
      closeDrawer={piutang.closeDrawer}
      vaDrawerOpen={piutang.vaDrawerOpen}
      mountVaDrawer={piutang.mountVaDrawer}
      vaDrawerActivity={piutang.vaDrawerActivity}
      closeVaDrawer={piutang.closeVaDrawer}
      getPaymentHistory={piutang.getPaymentHistory}
      updatePaymentVerification={piutang.updatePaymentVerification}
      userId={piutang.userId}
      organizationId={piutang.organizationId}
    />
  );
}
