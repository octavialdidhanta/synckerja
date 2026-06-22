import { lazy, Suspense, type ReactNode } from 'react';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import {
  INCOME_PIUTANG_MAIN_COLUMN,
  INCOME_PIUTANG_MAIN_GRID,
  INCOME_PIUTANG_SIDEBAR_COLUMN,
  INCOME_TX_TABLE_SECTION,
} from '@/4-1-transaction/layout/incomeTransactionLayout';
import { IncomeTransactionSidebarSkeleton } from '@/4-1-transaction/skeletons/IncomeTransactionSidebarSkeleton';
import { DeferredMount } from '@/shared/components/DeferredMount';
import type { PiutangVerificationAggregate } from '../types/piutang.types';
import { PiutangActivityTable } from '../components/PiutangActivityTable';
import { PiutangMetricsCards } from '../components/PiutangMetricsCards';
import { PiutangTableFooter } from '../components/PiutangTableFooter';

const PiutangSidebarColumn = lazy(() =>
  import('../components/PiutangSidebarColumn').then((m) => ({ default: m.PiutangSidebarColumn })),
);

const PiutangPaymentVerificationDrawer = lazy(() =>
  import('../components/PiutangPaymentVerificationDrawer').then((m) => ({
    default: m.PiutangPaymentVerificationDrawer,
  })),
);

const PiutangVaCollectionDrawer = lazy(() =>
  import('../components/PiutangVaCollectionDrawer').then((m) => ({
    default: m.PiutangVaCollectionDrawer,
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
  openVaDrawer?: (row: SalesActivity) => void;
  drawerOpen: boolean;
  mountDrawer: boolean;
  drawerActivity: SalesActivity | null;
  closeDrawer: (open: boolean) => void;
  vaDrawerOpen?: boolean;
  mountVaDrawer?: boolean;
  vaDrawerActivity?: SalesActivity | null;
  closeVaDrawer?: (open: boolean) => void;
  getPaymentHistory: ReturnType<
    typeof import('@/shared/hooks/organized/sales').useSalesActivityPayments
  >['getPaymentHistory'];
  updatePaymentVerification: ReturnType<
    typeof import('@/shared/hooks/organized/sales').useSalesActivityPayments
  >['updatePaymentVerification'];
  userId: string | undefined;
  organizationId: string | null | undefined;
};

/** Layout selaras `IncomeTransactionPage` — metrik atas, tabel tinggi tetap, sidebar scroll internal. */
export function IncomePiutangPageContent({
  filterBar,
  hideSidebar = false,
  filteredRows,
  verificationAggregateByActivity,
  verificationLoading,
  totalPiutangActivities,
  openDrawer,
  openVaDrawer,
  drawerOpen,
  mountDrawer,
  drawerActivity,
  closeDrawer,
  vaDrawerOpen = false,
  mountVaDrawer = false,
  vaDrawerActivity = null,
  closeVaDrawer,
  getPaymentHistory,
  updatePaymentVerification,
  userId,
  organizationId,
}: IncomePiutangPageContentProps) {
  return (
    <>
      <div className={INCOME_PIUTANG_MAIN_GRID}>
        <div
          className={`${
            hideSidebar ? `${INCOME_PIUTANG_MAIN_COLUMN} xl:col-span-12` : INCOME_PIUTANG_MAIN_COLUMN
          } flex flex-col gap-2`}
        >
          {filterBar}

          <PiutangMetricsCards
            filteredRows={filteredRows}
            verificationByActivity={verificationAggregateByActivity}
          />

          <div className={INCOME_TX_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
              <PiutangActivityTable
                rows={filteredRows}
                verificationByActivity={verificationAggregateByActivity}
                verificationLoading={verificationLoading}
                onOpenPayments={openDrawer}
                onOpenVaCollection={openVaDrawer}
              />
              <PiutangTableFooter
                totalActivities={totalPiutangActivities}
                filteredRows={filteredRows}
              />
            </div>
          </div>
        </div>

        {!hideSidebar ? (
          <div className={INCOME_PIUTANG_SIDEBAR_COLUMN}>
            <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <DeferredMount
                fallback={<IncomeTransactionSidebarSkeleton />}
                idleTimeoutMs={900}
                delayMs={80}
              >
                <Suspense fallback={<IncomeTransactionSidebarSkeleton />}>
                  <PiutangSidebarColumn
                    filteredRows={filteredRows}
                    totalActivities={totalPiutangActivities}
                    verificationByActivity={verificationAggregateByActivity}
                  />
                </Suspense>
              </DeferredMount>
            </div>
          </div>
        ) : null}
      </div>

      {mountDrawer ? (
        <Suspense fallback={null}>
          <PiutangPaymentVerificationDrawer
            open={drawerOpen}
            onOpenChange={closeDrawer}
            organizationId={organizationId}
            salesActivityId={drawerActivity?.id ?? null}
            clientLabel={String(drawerActivity?.client_name ?? '—')}
            getPaymentHistory={getPaymentHistory}
            updatePaymentVerification={updatePaymentVerification}
            userId={userId}
          />
        </Suspense>
      ) : null}

      {mountVaDrawer && closeVaDrawer ? (
        <Suspense fallback={null}>
          <PiutangVaCollectionDrawer
            open={vaDrawerOpen}
            onOpenChange={closeVaDrawer}
            organizationId={organizationId}
            salesActivityId={vaDrawerActivity?.id ?? null}
            clientLabel={String(vaDrawerActivity?.client_name ?? '—')}
            getPaymentHistory={getPaymentHistory}
          />
        </Suspense>
      ) : null}
    </>
  );
}
