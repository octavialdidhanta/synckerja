import { useMemo } from "react";
import { useIncomeMetrics } from "@/features/4-1-dashboard/hooks/useIncomeMetrics";
import { useIncomeTransactions } from "@/features/4-1-dashboard/hooks/useIncomeTransactions";
import { useBankAccountBalances } from "@/hooks/organized/useBankAccountBalances";

const getDateRangeForPeriod = (period: string): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  let startDate: Date;
  let endDate: Date = new Date(currentYear, currentMonth, currentDate + 1);

  switch (period) {
    case "This Month":
      startDate = new Date(currentYear, currentMonth, 1);
      break;
    case "Last Month": {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      startDate = new Date(lastMonthYear, lastMonth, 1);
      endDate = new Date(currentYear, currentMonth, 1);
      break;
    }
    case "Last 3 Months":
      startDate = new Date(currentYear, currentMonth - 3, 1);
      break;
    case "Last 6 Months":
      startDate = new Date(currentYear, currentMonth - 6, 1);
      break;
    case "This Year":
      startDate = new Date(currentYear, 0, 1);
      break;
    case "Last Year":
      startDate = new Date(currentYear - 1, 0, 1);
      endDate = new Date(currentYear, 0, 1);
      break;
    default:
      startDate = new Date(currentYear, currentMonth, 1);
  }
  return { startDate, endDate };
};

const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPreviousDateRangeForPeriod = (period: string): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  switch (period) {
    case "This Month": {
      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth, 1);
      return { startDate, endDate };
    }
    case "Last Month": {
      const startDate = new Date(currentYear, currentMonth - 2, 1);
      const endDate = new Date(currentYear, currentMonth - 1, 1);
      return { startDate, endDate };
    }
    case "Last 3 Months": {
      const startDate = new Date(currentYear, currentMonth - 6, 1);
      const endDate = new Date(currentYear, currentMonth - 3, 1);
      return { startDate, endDate };
    }
    case "Last 6 Months": {
      const startDate = new Date(currentYear, currentMonth - 12, 1);
      const endDate = new Date(currentYear, currentMonth - 6, 1);
      return { startDate, endDate };
    }
    case "This Year": {
      const startDate = new Date(currentYear - 1, 0, 1);
      const endDate = new Date(currentYear, 0, 1);
      return { startDate, endDate };
    }
    case "Last Year": {
      const startDate = new Date(currentYear - 2, 0, 1);
      const endDate = new Date(currentYear - 1, 0, 1);
      return { startDate, endDate };
    }
    default: {
      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth, currentDate + 1);
      return { startDate, endDate };
    }
  }
};

export function useIncomeDashboardStats(selectedPeriod: string = "This Month") {
  const { data: metrics, isLoading: metricsLoading } = useIncomeMetrics();
  const { incomeTransactions, isLoading: transactionsLoading } = useIncomeTransactions();
  const { balances, loading: balancesLoading } = useBankAccountBalances();

  const totalCurrentBalance = useMemo(
    () => balances.reduce((sum, item) => sum + (Number(item.balance) || 0), 0),
    [balances]
  );

  const totalIncome = useMemo(
    () => Number(metrics?.yearTotal || 0),
    [metrics?.yearTotal]
  );

  const totalIncomeMonthToDate = useMemo(() => {
    if (!incomeTransactions?.length) return 0;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);

    return incomeTransactions.reduce((sum, trx) => {
      const transactionDate = trx.transaction_date;
      if (transactionDate >= startDateStr && transactionDate < endDateStr) {
        return sum + Number(trx.amount || 0);
      }
      return sum;
    }, 0);
  }, [incomeTransactions]);

  const transactionsInSelectedPeriod = useMemo(() => {
    if (!incomeTransactions?.length) return null;
    const { startDate, endDate } = getDateRangeForPeriod(selectedPeriod);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);

    return incomeTransactions.filter((trx) => {
      const transactionDate = trx.transaction_date;
      return transactionDate >= startDateStr && transactionDate < endDateStr;
    });
  }, [incomeTransactions, selectedPeriod]);

  const transactionsInPreviousPeriod = useMemo(() => {
    if (!incomeTransactions?.length) return null;
    const { startDate, endDate } = getPreviousDateRangeForPeriod(selectedPeriod);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);

    return incomeTransactions.filter((trx) => {
      const transactionDate = trx.transaction_date;
      return transactionDate >= startDateStr && transactionDate < endDateStr;
    });
  }, [incomeTransactions, selectedPeriod]);

  const growth = useMemo(() => {
    const currentTotal = (transactionsInSelectedPeriod ?? []).reduce(
      (sum, trx) => sum + Number(trx.amount || 0),
      0
    );
    const previousTotal = (transactionsInPreviousPeriod ?? []).reduce(
      (sum, trx) => sum + Number(trx.amount || 0),
      0
    );

    if (previousTotal <= 0) {
      return currentTotal > 0 ? 100 : 0;
    }

    return ((currentTotal - previousTotal) / previousTotal) * 100;
  }, [transactionsInPreviousPeriod, transactionsInSelectedPeriod]);

  const highestInSelectedPeriod = useMemo(() => {
    if (!transactionsInSelectedPeriod?.length) return null;
    return transactionsInSelectedPeriod.reduce((maxTrx, trx) => {
      const amount = Number(trx.amount || 0);
      const maxAmount = Number(maxTrx.amount || 0);
      return amount > maxAmount ? trx : maxTrx;
    }, transactionsInSelectedPeriod[0]);
  }, [transactionsInSelectedPeriod]);

  const highest = useMemo(
    () => Number(highestInSelectedPeriod?.amount || 0),
    [highestInSelectedPeriod]
  );

  const highestRecordedAt = useMemo(
    () => highestInSelectedPeriod?.created_at || highestInSelectedPeriod?.transaction_date || null,
    [highestInSelectedPeriod]
  );

  const highestTransactionName = useMemo(
    () =>
      highestInSelectedPeriod?.description ||
      highestInSelectedPeriod?.customer_name ||
      highestInSelectedPeriod?.services?.name ||
      highestInSelectedPeriod?.income_types?.name ||
      null,
    [highestInSelectedPeriod]
  );

  const latestInSelectedPeriod = useMemo(
    () => transactionsInSelectedPeriod?.[0] ?? null,
    [transactionsInSelectedPeriod]
  );

  const latest = useMemo(
    () => Number(latestInSelectedPeriod?.amount || 0),
    [latestInSelectedPeriod]
  );

  const latestRecordedAt = useMemo(
    () => latestInSelectedPeriod?.created_at || latestInSelectedPeriod?.transaction_date || null,
    [latestInSelectedPeriod]
  );

  const latestTransactionName = useMemo(
    () =>
      latestInSelectedPeriod?.description ||
      latestInSelectedPeriod?.customer_name ||
      latestInSelectedPeriod?.services?.name ||
      latestInSelectedPeriod?.income_types?.name ||
      null,
    [latestInSelectedPeriod]
  );

  return {
    isLoading: metricsLoading || transactionsLoading || balancesLoading,
    totalCurrentBalance,
    totalIncome,
    totalIncomeMonthToDate,
    growth,
    highest,
    highestRecordedAt,
    highestTransactionName,
    latest,
    latestRecordedAt,
    latestTransactionName,
  };
}
