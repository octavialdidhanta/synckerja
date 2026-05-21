import { lazy, Suspense, useState, useCallback, useMemo } from 'react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
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
import { isIncomeAllocationIncomplete } from '@/4-1-dashboard/utils/incomeAllocationStatus';
import { useCanAllocateIncome } from '@/4-1-dashboard/hooks/useCanAllocateIncome';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

const IncomeTransactionSidebarColumn = lazy(() =>
  import('../section/IncomeTransactionSidebarColumn').then((m) => ({
    default: m.IncomeTransactionSidebarColumn,
  })),
);

/** Content area only (scroll/header handled by `IncomeTransactionModuleShell`). */
export function IncomeTransactionPage() {
  const { t } = useAppTranslation();
  const { canAllocateIncome } = useCanAllocateIncome();
  const [filters, setFilters] = useState<IncomeTransactionFiltersType>({
    search: '',
    status: 'all',
    type: 'all',
    category: 'all',
    allocation: 'all',
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

  const needsAllocationCount = useMemo(
    () => incomeTransactions.filter((tx) => isIncomeAllocationIncomplete(tx)).length,
    [incomeTransactions],
  );

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
      allocation: 'all',
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
          {canAllocateIncome && needsAllocationCount > 0 ? (
            <div className="mb-2 flex-shrink-0">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-900">
                  <span>
                    {t(
                      'incomes.allocation.banner',
                      '{{count}} transaction(s) need Type, Category, and Bank Account before they affect balance and completed reports.',
                      { count: needsAllocationCount },
                    )}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 border-amber-300 bg-white text-xs"
                    onClick={() => handleFilterChange('allocation', 'needs_allocation')}
                  >
                    {t('incomes.allocation.filterNeeds', 'Needs allocation')}
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

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
