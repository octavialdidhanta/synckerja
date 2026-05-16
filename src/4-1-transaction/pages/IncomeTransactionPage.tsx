import { lazy, Suspense, useState, useCallback, useMemo } from 'react';
import { IncomeTransactionFilters } from '../section/IncomeTransactionFilters';
import { IncomeTransactionMetricsCards } from '../section/IncomeTransactionMetricsCards';
import { IncomeTransactionTable } from '../section/IncomeTransactionTable';
import { IncomeTransactionTableFooter } from '../section/IncomeTransactionTableFooter';
import type { IncomeTransactionFiltersType } from '../section/IncomeTransactionFilters';
import { useIncomeTransactions } from '@/4-1-dashboard/hooks';
import { filterTransactions } from '../utils/transactionUtils';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import {
  IncomeTransactionContentSkeleton,
  IncomeTransactionSidebarSkeleton,
} from '@/4-1-transaction/skeletons';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { INCOME_TX_MAIN_GRID } from '@/4-1-transaction/layout/incomeTransactionLayout';
import { DeferredMount } from '@/shared/components/DeferredMount';

const IncomeTransactionSidebarColumn = lazy(() =>
  import('../section/IncomeTransactionSidebarColumn').then((m) => ({
    default: m.IncomeTransactionSidebarColumn,
  })),
);

/** Content area only (scroll/header handled by `IncomeTransactionModuleShell`). */
export function IncomeTransactionPage() {
  const [filters, setFilters] = useState<IncomeTransactionFiltersType>({
    search: '',
    status: 'all',
    type: 'all',
    category: 'all',
  });

  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const {
    incomeTransactions,
    isLoading: transactionsLoading,
    isPending: transactionsPending,
    refetch,
  } = useIncomeTransactions();

  /** Hanya transaksi — metrik & rekening bank punya placeholder sendiri (tidak menahan LCP). */
  const transactionsPendingLoad =
    Boolean(organizationId) && (transactionsLoading || transactionsPending);
  const rawPendingLoad = orgLoading || transactionsPendingLoad;
  const showContent = useDebouncedReady(!rawPendingLoad, 150);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const filteredTransactions = useMemo(() => {
    return filterTransactions(incomeTransactions, filters);
  }, [incomeTransactions, filters]);

  const handleFilterChange = useCallback(
    (key: keyof IncomeTransactionFiltersType, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: 'all',
      type: 'all',
      category: 'all',
    });
  }, []);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [filteredTransactions]);

  if (!showContent) {
    return <IncomeTransactionContentSkeleton />;
  }

  return (
    <div className={INCOME_TX_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-9">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="mb-2 flex-shrink-0">
            <div className="rounded-md border border-border bg-card p-2">
              <IncomeTransactionFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
              />
            </div>
          </div>

          <div className="mb-2 flex-shrink-0">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <IncomeTransactionMetricsCards />
            </div>
          </div>

          <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
            <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
              <IncomeTransactionTable
                transactions={filteredTransactions}
                onRefresh={handleRefresh}
              />
              <IncomeTransactionTableFooter
                totalTransactions={incomeTransactions.length}
                filteredTransactions={filteredTransactions.length}
                totalAmount={totalAmount}
                selectedType={filters.type}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-3">
        <DeferredMount
          fallback={<IncomeTransactionSidebarSkeleton />}
          idleTimeoutMs={900}
          delayMs={80}
        >
          <Suspense fallback={<IncomeTransactionSidebarSkeleton />}>
            <IncomeTransactionSidebarColumn
              transactions={filteredTransactions}
              totalAmount={totalAmount}
              selectedType={filters.type}
            />
          </Suspense>
        </DeferredMount>
      </div>
    </div>
  );
}
