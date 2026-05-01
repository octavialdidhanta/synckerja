import { useMemo } from "react";
import { useOrganizationDebtsQuery } from "@/shared/hooks/finance/useOrganizationDebtsQuery";
import type { Debt } from "@/shared/types/debt";
import { effectiveOutstandingBalance } from "@/4-2-debt/utils/resolveDebtDisplay";

export interface DebtForExpense {
  id: string;
  debt_name: string;
  status: string;
  debt_type?: string;
  available_limit?: number;
  limit_amount?: number;
  debt_amount?: number;
  paid_amount?: number;
  remaining_debt?: number;
}

function toDebtForExpenseRow(debt: Debt): DebtForExpense {
  const limit = debt.limit_amount ?? 0;
  const remaining = effectiveOutstandingBalance(debt);
  const available = Math.max(0, limit - remaining);
  return {
    id: debt.id,
    debt_name: debt.debt_name,
    status: debt.status,
    debt_type: debt.debt_type,
    available_limit: available,
    limit_amount: debt.limit_amount,
    debt_amount: debt.debt_amount,
    paid_amount: debt.paid_amount,
    remaining_debt: debt.remaining_debt,
  };
}

export const useDebtsForExpense = () => {
  const { data, isPending, refetch } = useOrganizationDebtsQuery();

  const debts = useMemo(() => {
    const list = data?.debts ?? [];
    return list
      .filter((d) => d.status === "active")
      .sort((a, b) => a.debt_name.localeCompare(b.debt_name))
      .map(toDebtForExpenseRow);
  }, [data?.debts]);

  return {
    debts,
    isLoading: isPending,
    refetch,
  };
};
