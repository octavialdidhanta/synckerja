import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useIncomeDashboardModel } from "@/4-1-dashboard/hooks/useIncomeDashboardModel";
import { IncomeDashboardDialogs } from "@/4-1-dashboard/components/IncomeDashboardDialogs";
import { cn } from "@/shared/lib/utils";
import { IncomeDashboardRefreshContext } from "@/mobile/3-dashboard/IncomeDashboardRefreshContext";
import { MobileIncomeDashboardFullViewportOverlay } from "@/mobile/3-dashboard/pages/MobileIncomeDashboardViewportSkeleton";
import { MobileIncomeDashboardCarousel } from "./MobileIncomeDashboardCarousel";
import { MobileIncomeDistributionCard } from "./MobileIncomeDistributionCard";
import { MobileNetIncomePerBankSection } from "./MobileNetIncomePerBankSection";

function trxLabel(t: {
  description?: string | null;
  customer_name?: string | null;
  services?: { name?: string | null } | null;
  income_types?: { name?: string | null } | null;
} | null) {
  if (!t) return null;
  return (
    t.description ||
    t.customer_name ||
    t.services?.name ||
    t.income_types?.name ||
    null
  );
}

function trxDate(t: { created_at?: string | null; transaction_date?: string | null } | null) {
  if (!t) return null;
  return t.created_at || t.transaction_date || null;
}

const SKELETON_MIN_MS = 200;

export function MobileIncomeDashboardTabContent() {
  const queryClient = useQueryClient();
  const refreshCtx = useContext(IncomeDashboardRefreshContext);
  const refetchRef = refreshCtx?.refetchRef;
  const isRefreshing = refreshCtx?.isRefreshing ?? false;

  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevPending = useRef(false);

  const model = useIncomeDashboardModel();
  const {
    rawPendingLoad,
    selectedPeriod,
    setSelectedPeriod,
    selectedType,
    setSelectedType,
    selectedBankAccount,
    setSelectedBankAccount,
    selectedYear,
    setSelectedYear,
    incomeDistributionTab,
    setIncomeDistributionTab,
    filteredTransactions,
    filteredMetrics,
    hasTransactionsWithoutType,
    incomeTypes,
    bankAccounts,
    bankAccountsLoading,
    bankAccountBalances,
    bankAccountNet,
    totalCurrentBalanceAllAccounts,
    highestTransactionInPeriod,
    latestTransactionInPeriod,
    growthPercentageFromMetrics,
    totalIncomeMonthToDate,
    yearTotalIncome,
    monthlyData,
    monthlyLoading,
    netBankOpenSwipeId,
    setNetBankOpenSwipeId,
    setBankTransferSource,
    setBankTransferDialogOpen,
  } = model;

  const invalidateIncome = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["income-metrics"] }),
      queryClient.invalidateQueries({ queryKey: ["income-transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["bank-account-balances"] }),
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["monthly-income-data"] }),
      queryClient.invalidateQueries({ queryKey: ["expense-metrics"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["income-types"] }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    if (!refetchRef) return;
    refetchRef.current = invalidateIncome;
    return () => {
      refetchRef.current = null;
    };
  }, [invalidateIncome, refetchRef]);

  useEffect(() => {
    const pending = rawPendingLoad;
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
      const tId = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setMinSettleDone(true);
            skeletonShownAtRef.current = null;
          });
        });
      }, remaining);
      return () => window.clearTimeout(tId);
    }

    skeletonShownAtRef.current = null;
    setMinSettleDone(true);
  }, [rawPendingLoad]);

  const displayBalance = useMemo(() => {
    if (selectedBankAccount === "all") return totalCurrentBalanceAllAccounts;
    const row = bankAccountBalances.find((b) => b.bank_account_id === selectedBankAccount);
    return row?.balance ?? 0;
  }, [selectedBankAccount, totalCurrentBalanceAllAccounts, bankAccountBalances]);

  const showPageSkeleton = (rawPendingLoad || !minSettleDone) && !isRefreshing;

  return (
    <div className="relative min-w-0">
      <div
        className={cn(
          "min-w-0 space-y-1",
          showPageSkeleton && "pointer-events-none invisible select-none",
        )}
        aria-hidden={showPageSkeleton}
      >
        <MobileIncomeDashboardCarousel
          isLoading={false}
          totalCurrentBalance={displayBalance}
          yearTotalIncome={yearTotalIncome}
          totalIncomeMonthToDate={totalIncomeMonthToDate}
          growthPercentage={growthPercentageFromMetrics}
          highest={filteredMetrics.highest}
          highestRecordedAt={trxDate(highestTransactionInPeriod)}
          highestTransactionName={trxLabel(highestTransactionInPeriod)}
          latest={filteredMetrics.latest}
          latestRecordedAt={trxDate(latestTransactionInPeriod)}
          latestTransactionName={trxLabel(latestTransactionInPeriod)}
        />

        <MobileIncomeDistributionCard
          filteredTransactions={filteredTransactions}
          monthlyData={monthlyData}
          monthlyLoading={monthlyLoading}
          incomeDistributionTab={incomeDistributionTab}
          onTabChange={setIncomeDistributionTab}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          selectedBankAccount={selectedBankAccount}
          onBankChange={setSelectedBankAccount}
          incomeTypes={incomeTypes}
          bankAccounts={bankAccounts}
          hasTransactionsWithoutType={hasTransactionsWithoutType}
          bankAccountsLoading={bankAccountsLoading}
        />

        <MobileNetIncomePerBankSection
          bankAccounts={bankAccounts}
          bankAccountBalances={bankAccountBalances}
          bankAccountNet={bankAccountNet}
          selectedBankAccount={selectedBankAccount}
          netBankOpenSwipeId={netBankOpenSwipeId}
          setNetBankOpenSwipeId={setNetBankOpenSwipeId}
          setBankTransferSource={setBankTransferSource}
          setBankTransferDialogOpen={setBankTransferDialogOpen}
        />
      </div>

      {showPageSkeleton &&
        typeof document !== "undefined" &&
        createPortal(<MobileIncomeDashboardFullViewportOverlay />, document.body)}

      <IncomeDashboardDialogs model={model} />
    </div>
  );
}
