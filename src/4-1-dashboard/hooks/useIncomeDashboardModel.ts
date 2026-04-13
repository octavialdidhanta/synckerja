import { useMemo, useState } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useBankAccounts, type BankAccount } from "@/shared/hooks/finance/useBankAccounts";
import { useBankAccountBalances } from "@/shared/hooks/finance/useBankAccountBalances";
import { useExpenses } from "@/shared/hooks/finance/useExpenses";
import { useExpenseMetrics } from "@/shared/hooks/finance/useExpenseMetrics";
import { useIncomeMetrics } from "./useIncomeMetrics";
import { useIncomeTransactions } from "./useIncomeTransactions";
import { useMonthlyIncomeData } from "./useMonthlyIncomeData";
import { useIncomeMasterData } from "./useIncomeMasterData";
import type { IncomeTransactionWithRelations } from "../types";

export type IncomeDistributionTabKey = "overview" | "service" | "monthly";

/** Mirrors `IncomeDashboard` period filters — keep in sync when changing desktop rules. */
function getDateRangeForPeriod(period: string): { startDate: Date; endDate: Date } {
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
}

function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useIncomeDashboardModel() {
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const [selectedType, setSelectedType] = useState("All Types");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("all");
  const [incomeDistributionTab, setIncomeDistributionTab] = useState<IncomeDistributionTabKey>("overview");
  const [netBankOpenSwipeId, setNetBankOpenSwipeId] = useState<string | null>(null);
  const [bankTransferDialogOpen, setBankTransferDialogOpen] = useState(false);
  const [bankTransferSource, setBankTransferSource] = useState<BankAccount | null>(null);

  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const { data: metrics, isLoading: metricsLoading } = useIncomeMetrics();
  const {
    incomeTransactions,
    isLoading: transactionsLoading,
    isPending: transactionsPending,
  } = useIncomeTransactions();
  const { data: monthlyData = [], isLoading: monthlyLoading } = useMonthlyIncomeData(selectedYear);
  const { incomeTypes, isLoading: masterDataLoading } = useIncomeMasterData();
  const { isLoading: expenseMetricsLoading } = useExpenseMetrics();
  const {
    bankAccounts,
    loading: bankAccountsLoading,
    isPending: bankAccountsPending,
  } = useBankAccounts();
  const {
    balances: bankAccountBalances,
    loading: balancesLoading,
    isPending: balancesPending,
  } = useBankAccountBalances();
  const { expenses, isLoading: expensesLoading } = useExpenses();

  const filteredTransactions = useMemo(() => {
    if (!incomeTransactions.length) return [];

    const { startDate, endDate } = getDateRangeForPeriod(selectedPeriod);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);

    return incomeTransactions.filter((transaction) => {
      const transactionDate = transaction.transaction_date;
      const isInDateRange = transactionDate >= startDateStr && transactionDate < endDateStr;

      const transactionType = transaction.income_types?.name || "";
      let matchesType = true;
      if (selectedType === "All Types") {
        matchesType = true;
      } else if (selectedType === "Other") {
        matchesType = !transactionType;
      } else {
        matchesType = transactionType === selectedType;
      }

      let matchesBankAccount = true;
      if (selectedBankAccount !== "all") {
        matchesBankAccount = transaction.bank_account_id === selectedBankAccount;
      }

      const isValidStatus = transaction.status === "completed" || transaction.status === "pending";

      return isInDateRange && matchesType && matchesBankAccount && isValidStatus;
    });
  }, [incomeTransactions, selectedPeriod, selectedType, selectedBankAccount]);

  const filteredExpenses = useMemo(() => {
    if (!expenses.length) return [];

    const { startDate, endDate } = getDateRangeForPeriod(selectedPeriod);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);

    return expenses.filter((expense) => {
      const expenseDate = expense.create_date;
      const isInDateRange = expenseDate >= startDateStr && expenseDate < endDateStr;

      let matchesBankAccount = true;
      if (selectedBankAccount !== "all") {
        matchesBankAccount = (expense as { bank_account_id?: string }).bank_account_id === selectedBankAccount;
      }

      return isInDateRange && matchesBankAccount;
    });
  }, [expenses, selectedPeriod, selectedBankAccount]);

  const bankAccountNet = useMemo(() => {
    const netMap: Record<string, { income: number; expense: number; net: number; balance: number }> = {};

    bankAccountBalances.forEach((balance) => {
      netMap[balance.bank_account_id] = {
        income: 0,
        expense: 0,
        net: 0,
        balance: balance.balance,
      };
    });

    filteredTransactions.forEach((transaction) => {
      if (transaction.bank_account_id) {
        if (!netMap[transaction.bank_account_id]) {
          netMap[transaction.bank_account_id] = {
            income: 0,
            expense: 0,
            net: 0,
            balance: 0,
          };
        }
        netMap[transaction.bank_account_id].income += parseFloat(transaction.amount.toString());
      }
    });

    filteredExpenses.forEach((expense) => {
      const bankAccountId = (expense as { bank_account_id?: string }).bank_account_id;
      if (bankAccountId) {
        if (!netMap[bankAccountId]) {
          netMap[bankAccountId] = {
            income: 0,
            expense: 0,
            net: 0,
            balance: 0,
          };
        }
        netMap[bankAccountId].expense += expense.amount;
      }
    });

    Object.keys(netMap).forEach((bankAccountId) => {
      netMap[bankAccountId].net = netMap[bankAccountId].income - netMap[bankAccountId].expense;
    });

    return netMap;
  }, [filteredTransactions, filteredExpenses, bankAccountBalances]);

  const filteredMetrics = useMemo(() => {
    if (!filteredTransactions.length) {
      return { total: 0, highest: 0, latest: 0, count: 0 };
    }

    const amounts = filteredTransactions.map((t) => parseFloat(t.amount.toString()));
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    const highest = Math.max(...amounts);
    const latest = filteredTransactions[0] ? parseFloat(filteredTransactions[0].amount.toString()) : 0;

    return {
      total,
      highest,
      latest,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  const hasTransactionsWithoutType = useMemo(
    () => incomeTransactions.some((t) => !t.income_types?.name),
    [incomeTransactions],
  );

  const highestTransactionInPeriod = useMemo((): IncomeTransactionWithRelations | null => {
    if (!filteredTransactions.length) return null;
    let best = filteredTransactions[0];
    let bestAmt = parseFloat(best.amount.toString());
    for (const t of filteredTransactions) {
      const a = parseFloat(t.amount.toString());
      if (a > bestAmt) {
        best = t;
        bestAmt = a;
      }
    }
    return best;
  }, [filteredTransactions]);

  const latestTransactionInPeriod = useMemo((): IncomeTransactionWithRelations | null => {
    if (!filteredTransactions.length) return null;
    let best = filteredTransactions[0];
    let bestDate = best.transaction_date || best.created_at || "";
    for (const t of filteredTransactions) {
      const d = t.transaction_date || t.created_at || "";
      if (d > bestDate) {
        best = t;
        bestDate = d;
      }
    }
    return best;
  }, [filteredTransactions]);

  const totalCurrentBalanceAllAccounts = useMemo(
    () => bankAccountBalances.reduce((total, b) => total + (b.balance || 0), 0),
    [bankAccountBalances],
  );

  const growthPercentageFromMetrics = metrics?.growthPercentage ?? 0;
  const totalIncomeMonthToDate = metrics?.currentMonthTotal ?? 0;
  const yearTotalIncome = metrics?.yearTotal ?? 0;

  const dataPending =
    Boolean(organizationId) &&
    (metricsLoading ||
      transactionsLoading ||
      transactionsPending ||
      monthlyLoading ||
      masterDataLoading ||
      expenseMetricsLoading ||
      bankAccountsLoading ||
      bankAccountsPending ||
      balancesLoading ||
      balancesPending ||
      expensesLoading);
  const rawPendingLoad = orgLoading || dataPending;

  return {
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
    bankTransferDialogOpen,
    bankTransferSource,
  };
}

export type IncomeDashboardModel = ReturnType<typeof useIncomeDashboardModel>;
