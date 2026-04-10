import { useState, useEffect, useRef, useContext } from "react";
import { ExpenseDashboardCarousel } from "@/mobile/pages/expenses/section/ExpenseDashboardCarousel";
import { ExpenseBreakdownSection } from "@/mobile/pages/expenses/section/ExpenseBreakdownSection";
import { ExpenseTableSection } from "@/mobile/pages/expenses/section/ExpenseTableSection";
import { useExpenseTable, type DateFilterValue } from "@/mobile/pages/expenses/hooks/useExpenseTable";
import { useExpenseDashboardStats } from "@/mobile/pages/expenses/hooks/useExpenseDashboardStats";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { ExpenseDashboardRefreshContext } from "@/mobile/pages/expenses/ExpenseDashboardRefreshContext";

const SKELETON_MIN_MS = 200;

const DATE_FILTER_LABEL_KEYS: Record<DateFilterValue, string> = {
  "all-dates": "expenses.dateFilter.allDates",
  today: "expenses.dateFilter.today",
  yesterday: "expenses.dateFilter.yesterday",
  "this-week": "expenses.dateFilter.thisWeek",
  "this-month": "expenses.dateFilter.thisMonth",
  "last-month": "expenses.dateFilter.lastMonth",
  "3-months-ago": "expenses.dateFilter.3MonthsAgo",
  "6-months-ago": "expenses.dateFilter.6MonthsAgo",
  "this-year": "expenses.dateFilter.thisYear",
  "last-year": "expenses.dateFilter.lastYear",
  custom: "expenses.dateFilter.customRange",
};

/**
 * Dashboard tab content for mobile Expense page.
 * Single source of truth for filters: useExpenseTable drives table, breakdown, and carousel stats.
 * YTD card stays independent (useExpenseDashboardStats); Quick View unchanged.
 * Pull-to-refresh: refetchRef di-set di sini; skeleton hanya saat load awal (bukan saat isRefreshing).
 */
export function DashboardTabContent() {
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const isRefreshing = refreshContext?.isRefreshing ?? false;
  const { t } = useAppTranslation();
  const expenseTable = useExpenseTable();
  const { totalExpensesYTD, ytdTransactionCount } = useExpenseDashboardStats();
  const periodLabel = t(DATE_FILTER_LABEL_KEYS[expenseTable.dateFilter], expenseTable.dateFilter);

  const [skeletonShownAt, setSkeletonShownAt] = useState<number | null>(null);
  const [minPeriodDone, setMinPeriodDone] = useState(true);
  const prevLoading = useRef(expenseTable.isLoading);
  const hasLoadedOnce = useRef(false);
  const didRecoveryRefetch = useRef(false);

  useEffect(() => {
    if (didRecoveryRefetch.current || expenseTable.isLoading || expenseTable.allExpenses.length > 0) return;
    didRecoveryRefetch.current = true;
    expenseTable.refreshData().catch(() => {});
  }, [expenseTable.isLoading, expenseTable.allExpenses.length, expenseTable.refreshData]);

  useEffect(() => {
    if (refetchRef) {
      refetchRef.current = expenseTable.refreshData;
      return () => {
        refetchRef.current = null;
      };
    }
  }, [refetchRef, expenseTable.refreshData]);

  useEffect(() => {
    const loading = expenseTable.isLoading;
    const wasLoading = prevLoading.current;
    prevLoading.current = loading;
    if (loading) {
      setSkeletonShownAt((prev) => prev ?? Date.now());
      setMinPeriodDone(false);
    } else {
      hasLoadedOnce.current = true;
      if (wasLoading && skeletonShownAt !== null) {
        const elapsed = Date.now() - skeletonShownAt;
        const remaining = Math.max(0, SKELETON_MIN_MS - elapsed);
        const tId = setTimeout(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setMinPeriodDone(true);
              setSkeletonShownAt(null);
            });
          });
        }, remaining);
        return () => clearTimeout(tId);
      } else {
        setMinPeriodDone(true);
        setSkeletonShownAt(null);
      }
    }
  }, [expenseTable.isLoading, skeletonShownAt]);

  const effectiveLoading =
    expenseTable.isLoading || !minPeriodDone || !hasLoadedOnce.current;
  const showSkeleton = effectiveLoading && !isRefreshing;

  return (
    <>
      <ExpenseDashboardCarousel
        currentMonthTotal={expenseTable.currentMonthTotal}
        highestExpense={expenseTable.highestExpense}
        latestExpense={expenseTable.latestExpense}
        totalExpensesYTD={totalExpensesYTD}
        ytdTransactionCount={ytdTransactionCount}
        isLoading={showSkeleton}
      />
      <div className="px-2 pt-4">
        <ExpenseBreakdownSection
          allExpenses={expenseTable.allExpenses}
          allExpensesForCategoryBreakdown={expenseTable.allExpensesForCategoryBreakdown}
          totalExpenses={expenseTable.totalExpenses}
          isLoadingBreakdown={showSkeleton}
          periodLabel={periodLabel}
        />
      </div>
      <ExpenseTableSection expenseTable={{ ...expenseTable, isLoading: showSkeleton }} />
    </>
  );
}
