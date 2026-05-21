import { useCallback, useMemo, useState } from "react";
import { useIncomeTransactions, useIncomeMetrics } from "@/4-1-dashboard/hooks";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useBankAccounts } from "@/shared/hooks/finance/useBankAccounts";
import type { IncomeTransactionFilters } from "@/4-1-transaction/section/IncomeTransactionFilters";
import { filterTransactions, type IncomeTransaction } from "@/4-1-transaction/utils/transactionUtils";

/** Mobile drawer uses `period` keys (`this_month`, …); desktop list ignores `period` in `filterTransactions`. */
export type IncomeTransactionPageFilters = IncomeTransactionFilters & {
  period: string;
};

function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Date bounds for mobile period filter (`all` → null). */
function getPeriodBounds(period: string): { start: Date; endExclusive: Date } | null {
  if (!period || period === "all") return null;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const endToday = new Date(y, m, d + 1);

  switch (period) {
    case "this_month":
      return { start: new Date(y, m, 1), endExclusive: endToday };
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return { start: new Date(ly, lm, 1), endExclusive: new Date(y, m, 1) };
    }
    case "last_3_months":
      return { start: new Date(y, m - 3, 1), endExclusive: endToday };
    case "last_6_months":
      return { start: new Date(y, m - 6, 1), endExclusive: endToday };
    case "this_year":
      return { start: new Date(y, 0, 1), endExclusive: endToday };
    case "last_year":
      return { start: new Date(y - 1, 0, 1), endExclusive: new Date(y, 0, 1) };
    default:
      return null;
  }
}

const defaultFilters: IncomeTransactionPageFilters = {
  search: "",
  status: "all",
  type: "all",
  category: "all",
  allocation: "all",
  period: "all",
};

export function useIncomeTransactionPageModel() {
  const [filters, setFilters] = useState<IncomeTransactionPageFilters>({ ...defaultFilters });

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

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const filteredTransactions = useMemo(() => {
    const { period, ...rest } = filters;
    const base = filterTransactions(incomeTransactions as IncomeTransaction[], rest);
    const bounds = getPeriodBounds(period);
    if (!bounds) return base;
    const startStr = formatDateToString(bounds.start);
    const endStr = formatDateToString(bounds.endExclusive);
    return base.filter((t) => {
      const td = t.transaction_date;
      return td >= startStr && td < endStr;
    });
  }, [incomeTransactions, filters]);

  const handleFilterChange = useCallback((key: keyof IncomeTransactionPageFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
  }, []);

  const totalAmount = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
    [filteredTransactions],
  );

  return {
    filters,
    incomeTransactions,
    transactionsLoading,
    filteredTransactions,
    totalAmount,
    rawPendingLoad,
    handleRefresh,
    handleFilterChange,
    handleClearFilters,
  };
}

export type IncomeTransactionPageModel = ReturnType<typeof useIncomeTransactionPageModel>;
