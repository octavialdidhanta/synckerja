import { lazy, Suspense, type ReactNode } from 'react';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import {
  INCOME_TX_MAIN_GRID,
  INCOME_TX_TABLE_SECTION,
} from '@/4-1-transaction/layout/incomeTransactionLayout';
import { IncomeTransactionSidebarSkeleton } from '@/4-1-transaction/skeletons/IncomeTransactionSidebarSkeleton';
import { DeferredMount } from '@/shared/components/DeferredMount';
import type { PiutangVerificationAggregate } from '../types/piutang.types';
import { PiutangActivityTable } from '../components/PiutangActivityTable';
import { PiutangTableFooter } from '../components/PiutangTableFooter';

const PiutangSidebarColumn = lazy(() =>
  import('../components/PiutangSidebarColumn').then((m) => ({ default: m.PiutangSidebarColumn })),
);

const PiutangPaymentVerificationDrawer = lazy(() =>
  import('../components/PiutangPaymentVerificationDrawer').then((m) => ({
    default: m.PiutangPaymentVerificationDrawer,
  })),
);

export type IncomePiutangPageContentProps = {
  filterBar?: ReactNode;
  hideSidebar?: boolean;
  filteredRows: SalesActivity[];
  verificationAggregateByActivity: ReadonlyMap<string, PiutangVerificationAggregate>;
  verificationLoading: boolean;
  totalPiutangActivities: number;
  openDrawer: (row: SalesActivity) => void;
  drawerOpen: boolean;
  mountDrawer: boolean;
  drawerActivity: SalesActivity | null;
  closeDrawer: (open: boolean) => void;
  getPaymentHistory: ReturnType<
    typeof import('@/shared/hooks/organized/sales').useSalesActivityPayments
  >['getPaymentHistory'];
  updatePaymentVerification: ReturnType<
    typeof import('@/shared/hooks/organized/sales').useSalesActivityPayments
  >['updatePaymentVerification'];
  userId: string | undefined;
};

/** Layout selaras `IncomeTransactionPage` — footer tabel di dasar viewport (+ `pb-2` shell). */
export function IncomePiutangPageContent({
  filterBar,
  hideSidebar = false,
  filteredRows,
  verificationAggregateByActivity,
  verificationLoading,
  totalPiutangActivities,
  openDrawer,
  drawerOpen,
  mountDrawer,
  drawerActivity,
  closeDrawer,
  getPaymentHistory,
  updatePaymentVerification,
  userId,
}: IncomePiutangPageContentProps) {
  return (
    <>
      <div className={INCOME_TX_MAIN_GRID}>
        <div
          className={
            hideSidebar
              ? 'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden'
              : 'col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-9'
          }
        >
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            {filterBar ? <div className="mb-2 flex-shrink-0">{filterBar}</div> : null}
            <div className={INCOME_TX_TABLE_SECTION}>
              <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                <PiutangActivityTable
                  rows={filteredRows}
                  verificationByActivity={verificationAggregateByActivity}
                  verificationLoading={verificationLoading}
                  onOpenPayments={openDrawer}
                />
                <PiutangTableFooter
                  totalActivities={totalPiutangActivities}
                  filteredRows={filteredRows}
                />
              </div>
            </div>
          </div>
        </div>

        {!hideSidebar ? (
          <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-3">
            <DeferredMount
              fallback={<IncomeTransactionSidebarSkeleton />}
              idleTimeoutMs={900}
              delayMs={80}
            >
              <Suspense fallback={<IncomeTransactionSidebarSkeleton />}>
                <PiutangSidebarColumn filteredRows={filteredRows} />
              </Suspense>
            </DeferredMount>
          </div>
        ) : null}
      </div>

      {mountDrawer ? (
        <Suspense fallback={null}>
          <PiutangPaymentVerificationDrawer
            open={drawerOpen}
            onOpenChange={closeDrawer}
            salesActivityId={drawerActivity?.id ?? null}
            clientLabel={String(drawerActivity?.client_name ?? '—')}
            getPaymentHistory={getPaymentHistory}
            updatePaymentVerification={updatePaymentVerification}
            userId={userId}
          />
        </Suspense>
      ) : null}
    </>
  );
}
