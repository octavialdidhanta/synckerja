import { lazy, Suspense } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { MobileIncomePiutangBodySkeleton } from '@/mobile/3-incomes/pages/MobileIncomePiutangViewportSkeleton';
import { useIncomePiutangPage } from '@/4-1-transaction/piutang/hooks/useIncomePiutangPage';
import { MobilePiutangMetricsCarousel } from '@/mobile/3-incomes/section/MobilePiutangMetricsCarousel';
import { MobilePiutangFilters } from '@/mobile/3-incomes/section/MobilePiutangFilters';
import { MobilePiutangActivityTable } from '@/mobile/3-incomes/section/MobilePiutangActivityTable';
import { MobilePiutangTableFooter } from '@/mobile/3-incomes/section/MobilePiutangTableFooter';

const PiutangPaymentVerificationDrawer = lazy(() =>
  import('@/4-1-transaction/piutang/components/PiutangPaymentVerificationDrawer').then((m) => ({
    default: m.PiutangPaymentVerificationDrawer,
  })),
);

export function MobileIncomePiutangSection() {
  const piutang = useIncomePiutangPage();

  if (!piutang.showContent) {
    return <MobileIncomePiutangBodySkeleton />;
  }

  return (
    <>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-1">
        <div className="shrink-0">
          <MobilePiutangMetricsCarousel metrics={piutang.metrics} />
        </div>

        <Card className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden border border-border bg-card">
          <CardContent className="flex min-h-0 min-w-0 flex-col p-0">
            <div className="min-w-0 flex-shrink-0 border-b border-border bg-muted/50 px-1.5 py-1.5">
              <MobilePiutangFilters
                search={piutang.search}
                status={piutang.status}
                verification={piutang.verificationFilter}
                onSearchChange={piutang.setSearch}
                onStatusChange={piutang.setStatus}
                onVerificationChange={piutang.setVerificationFilter}
                onClearFilters={piutang.handleClearFilters}
              />
            </div>

            <div className="min-h-0 min-w-0 shrink-0">
              <MobilePiutangActivityTable
                rows={piutang.filteredRows}
                verificationByActivity={piutang.verificationAggregateByActivity}
                verificationLoading={piutang.verificationLoading}
                onOpenPayments={piutang.openDrawer}
              />
            </div>

            <MobilePiutangTableFooter
              totalActivities={piutang.totalPiutangActivities}
              filteredRows={piutang.filteredRows}
            />
          </CardContent>
        </Card>
      </div>

      {piutang.mountDrawer ? (
        <Suspense fallback={null}>
          <PiutangPaymentVerificationDrawer
            open={piutang.drawerOpen}
            onOpenChange={piutang.closeDrawer}
            salesActivityId={piutang.drawerActivity?.id ?? null}
            clientLabel={String(piutang.drawerActivity?.client_name ?? '—')}
            getPaymentHistory={piutang.getPaymentHistory}
            updatePaymentVerification={piutang.updatePaymentVerification}
            userId={piutang.userId}
          />
        </Suspense>
      ) : null}
    </>
  );
}
