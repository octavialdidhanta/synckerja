import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExpenseDashboardCarousel } from "@/mobile/2-expense/section/dashboard/ExpenseDashboardCarousel";
import { ExpenseBreakdownSection } from "@/mobile/2-expense/section/dashboard/ExpenseBreakdownSection";
import { ExpenseTableSection } from "@/mobile/2-expense/section/dashboard/ExpenseTableSection";
import { MobileExpenseDashboardFullViewportOverlay } from "@/mobile/2-expense/pages/MobileExpenseDashboardPageSkeleton";
import { useExpenseTable, type DateFilterValue } from "@/shared/hooks/finance/useExpenseTable";
import { useExpenseDashboardStats } from "@/shared/hooks/finance/useExpenseDashboardStats";
import { useBankAccountBalances } from "@/shared/hooks/finance/useBankAccountBalances";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ExpenseDashboardRefreshContext } from "@/mobile/2-expense/ExpenseDashboardRefreshContext";
import { cn } from "@/shared/lib/utils";

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

export function DashboardTabContent() {
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const isRefreshing = refreshContext?.isRefreshing ?? false;
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { loading: bankBalancesLoading } = useBankAccountBalances();
  const expenseTable = useExpenseTable();
  const {
    totalExpensesYTD,
    ytdTransactionCount,
    isLoading: dashboardStatsLoading,
  } = useExpenseDashboardStats();
  const periodLabel = t(DATE_FILTER_LABEL_KEYS[expenseTable.dateFilter], expenseTable.dateFilter);

  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevPending = useRef(false);
  const didRecoveryRefetch = useRef(false);

  const dataPending =
    orgLoading ||
    (Boolean(organizationId) &&
      (expenseTable.isLoading ||
        expenseTable.departmentsLoading ||
        expenseTable.debtsLoading ||
        expenseTable.bankAccountsLoading ||
        bankBalancesLoading ||
        dashboardStatsLoading));

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
    const pending = dataPending;
    const wasPending = prevPending.current;
    prevPending.current = pending;

    if (pending) {
      if (skeletonShownAtRef.current == null) skeletonShownAtRef.current = Date.now();
      setMinSettleDone(false);
      return;
    }

    if (wasPending && skeletonShownAtRef.current != null) {
      const elapsed = Date.now() - skeletonShownAtRef.current;
      const remaining = Math.max(0, SKELETON_MIN_MS - elapsed);
      const tId = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setMinSettleDone(true);
            skeletonShownAtRef.current = null;
          });
        });
      }, remaining);
      return () => clearTimeout(tId);
    }

    skeletonShownAtRef.current = null;
    setMinSettleDone(true);
  }, [dataPending]);

  const showPageSkeleton = (dataPending || !minSettleDone) && !isRefreshing;

  return (
    <div className="relative min-w-0">
      <div
        className={cn(
          "min-w-0 space-y-1",
          showPageSkeleton && "pointer-events-none invisible",
        )}
      >
        <ExpenseDashboardCarousel
          currentMonthTotal={expenseTable.currentMonthTotal}
          highestExpense={expenseTable.highestExpense}
          latestExpense={expenseTable.latestExpense}
          totalExpensesYTD={totalExpensesYTD}
          ytdTransactionCount={ytdTransactionCount}
        />
        <ExpenseBreakdownSection
          allExpenses={expenseTable.allExpenses}
          allExpensesForCategoryBreakdown={expenseTable.allExpensesForCategoryBreakdown}
          totalExpenses={expenseTable.totalExpenses}
          periodLabel={periodLabel}
        />
        <ExpenseTableSection expenseTable={{ ...expenseTable, isLoading: false }} />
      </div>

      {showPageSkeleton &&
        typeof document !== "undefined" &&
        createPortal(<MobileExpenseDashboardFullViewportOverlay />, document.body)}
    </div>
  );
}
