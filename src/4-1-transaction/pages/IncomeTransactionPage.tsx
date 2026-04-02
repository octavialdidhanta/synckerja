import { useState, useCallback, useMemo } from 'react';
import { 
  IncomeTransactionFilters,
  IncomeTransactionMetricsCards,
  IncomeTransactionTable,
  IncomeTransactionOverview,
  IncomeTransactionTableFooter,
  IncomeTransactionSidebarFooter,
  type IncomeTransactionFiltersType,
} from '../section';
import { useIncomeTransactions, useIncomeMetrics } from '@/4-1-dashboard/hooks';
import { filterTransactions } from '../utils/transactionUtils';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { IncomeTransactionSkeleton } from '@/4-1-transaction/components/IncomeTransactionSkeleton';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useBankAccounts } from '@/shared/hooks/finance/useBankAccounts';
import { cn } from '@/shared/lib/utils';

/** Content area only (scroll/header handled by `IncomeTransactionModuleShell`). */
const INCOME_TX_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]';

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

  const { isLoading: metricsLoading } = useIncomeMetrics();

  const {
    loading: bankAccountsLoading,
    isPending: bankAccountsPending,
  } = useBankAccounts({ includeInactive: true });

  const dataPending =
    Boolean(organizationId) &&
    (transactionsLoading ||
      transactionsPending ||
      metricsLoading ||
      bankAccountsLoading ||
      bankAccountsPending);

  const rawPendingLoad = orgLoading || dataPending;
  const showContent = useDebouncedReady(!rawPendingLoad);

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
                    isLoading={transactionsLoading}
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
            <div className="flex h-full min-h-0 min-w-0 flex-col">
              <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground">Income Overview</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Summary of income transactions
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                  <div className="h-full min-h-0 overflow-hidden p-4">
                    <IncomeTransactionOverview transactions={filteredTransactions} />
                  </div>
                </div>

                <IncomeTransactionSidebarFooter
                  totalTransactions={filteredTransactions.length}
                  totalAmount={totalAmount}
                  selectedType={filters.type}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
          aria-busy
        >
          <IncomeTransactionSkeleton />
        </div>
      ) : null}
    </>
  );
}

