import { useCallback, useMemo, useState } from 'react';
import { useSalesActivities, useSalesActivityPayments, type SalesActivity } from '@/shared/hooks/organized/sales';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { cn } from '@/shared/lib/utils';
import { INCOME_TX_MAIN_GRID } from '@/4-1-transaction/layout/incomeTransactionLayout';
import { IncomePiutangPageSkeleton } from '../skeletons/IncomePiutangPageSkeleton';
import type { PiutangFilterMode, PiutangVerificationFilterMode } from '../types/piutang.types';
import { usePiutangActivityRows } from '../hooks/usePiutangActivityRows';
import { usePiutangPaymentVerificationByActivity } from '../hooks/usePiutangPaymentVerificationByActivity';
import { PiutangFilters } from '../components/PiutangFilters';
import { PiutangMetricsCards } from '../components/PiutangMetricsCards';
import { PiutangActivityTable } from '../components/PiutangActivityTable';
import { PiutangTableFooter } from '../components/PiutangTableFooter';
import { PiutangOverviewPanel } from '../components/PiutangOverviewPanel';
import { PiutangSidebarFooter } from '../components/PiutangSidebarFooter';
import { PiutangPaymentVerificationDrawer } from '../components/PiutangPaymentVerificationDrawer';
import { matchesPiutangStatusFilter } from '../utils/piutangFilter';

export function IncomePiutangPage() {
  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const { activities, loading: activitiesLoading } = useSalesActivities();
  const { getPaymentHistory, updatePaymentVerification } = useSalesActivityPayments();
  const { user } = useCurrentUser();

  const [status, setStatus] = useState<PiutangFilterMode>('open');
  const [verificationFilter, setVerificationFilter] = useState<PiutangVerificationFilterMode>('all');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerActivity, setDrawerActivity] = useState<SalesActivity | null>(null);

  const { verificationAggregateByActivity, verificationFilterInfoByActivity, verificationLoading } =
    usePiutangPaymentVerificationByActivity(activities);

  const filteredRows = usePiutangActivityRows(
    activities,
    status,
    search,
    verificationFilter,
    verificationFilterInfoByActivity,
    verificationLoading,
  );

  const dataPending = Boolean(organizationId) && activitiesLoading;
  const rawPendingLoad = orgLoading || dataPending;
  const showContent = useDebouncedReady(!rawPendingLoad);

  const openDrawer = useCallback((row: SalesActivity) => {
    setDrawerActivity(row);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) setDrawerActivity(null);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatus('open');
    setVerificationFilter('all');
  }, []);

  const totalPiutangActivities = useMemo(
    () => activities.filter((a) => matchesPiutangStatusFilter(a, 'all')).length,
    [activities],
  );

  return (
    <>
      <div
        className={cn(
          'flex min-h-0 w-full min-w-0 flex-1 flex-col',
          !showContent && 'pointer-events-none invisible select-none',
        )}
        aria-hidden={!showContent}
      >
        <div className={INCOME_TX_MAIN_GRID}>
          <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-9">
            <div className="flex h-full min-h-0 min-w-0 flex-col">
              <div className="mb-2 flex-shrink-0">
                <div className="rounded-md border border-border bg-card p-2">
                  <PiutangFilters
                    search={search}
                    status={status}
                    verification={verificationFilter}
                    onSearchChange={setSearch}
                    onStatusChange={setStatus}
                    onVerificationChange={setVerificationFilter}
                    onClearFilters={handleClearFilters}
                  />
                </div>
              </div>

              <div className="mb-2 flex-shrink-0">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <PiutangMetricsCards rows={filteredRows} />
                </div>
              </div>

              <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                  <PiutangActivityTable
                    rows={filteredRows}
                    loading={activitiesLoading}
                    verificationByActivity={verificationAggregateByActivity}
                    verificationLoading={verificationLoading}
                    onOpenPayments={openDrawer}
                  />
                  <PiutangTableFooter totalActivities={totalPiutangActivities} filteredRows={filteredRows} />
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-3">
            <div className="flex h-full min-h-0 min-w-0 flex-col">
              <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground">Ringkasan piutang</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Ikhtisar berdasarkan filter saat ini</p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                  <div className="h-full min-h-0 overflow-hidden p-4">
                    <PiutangOverviewPanel filteredRows={filteredRows} />
                  </div>
                </div>

                <PiutangSidebarFooter filteredRows={filteredRows} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <PiutangPaymentVerificationDrawer
        open={drawerOpen}
        onOpenChange={closeDrawer}
        salesActivityId={drawerActivity?.id ?? null}
        clientLabel={String(drawerActivity?.client_name ?? '—')}
        getPaymentHistory={getPaymentHistory}
        updatePaymentVerification={updatePaymentVerification}
        userId={user?.id}
      />

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
          aria-busy
        >
          <IncomePiutangPageSkeleton />
        </div>
      ) : null}
    </>
  );
}
