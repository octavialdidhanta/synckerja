import { useMemo } from "react";
import { useDebts } from "@/features/4_2_debt/hooks";
import { debtDisplayBalance } from "@/features/4_2_debt/utils/resolveDebtDisplay";

export function useDebtDashboardStats() {
  const { debts, totalInterestYtd, isLoading } = useDebts();

  const totalDebt = useMemo(() => {
    return debts.reduce((sum, debt) => sum + debtDisplayBalance(debt), 0);
  }, [debts]);

  const totalLimit = useMemo(() => {
    return debts.reduce((sum, debt) => sum + debt.limit_amount, 0);
  }, [debts]);

  const activeDebts = useMemo(() => {
    return debts.filter((debt) => debt.status === "active");
  }, [debts]);

  const activeDebtTotal = useMemo(() => {
    return activeDebts.reduce((sum, debt) => sum + debtDisplayBalance(debt), 0);
  }, [activeDebts]);

  return {
    isLoading,
    debts,
    totalDebt,
    totalLimit,
    activeDebts,
    activeDebtTotal,
    totalInterestYtd,
  };
}
