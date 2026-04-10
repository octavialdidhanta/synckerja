import { useContext, useEffect } from "react";
import { useBillsDashboardStats } from "./hooks/useBillsDashboardStats";
import { BillsDashboardCarousel } from "./section/BillsDashboardCarousel";
import { BillsTableSection } from "./section/BillsTableSection";
import { useReminderBillsData } from "./hooks/useReminderBillsData";
import { usePurchaseRequests } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { ExpenseDashboardRefreshContext } from "@/mobile/pages/expenses/ExpenseDashboardRefreshContext";

export function BillsTabContent() {
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const { refetch: refetchBills } = useReminderBillsData();
  const { refetch: refetchRequests } = usePurchaseRequests();
  const { isLoading, totalRecurringBills, dueThisWeek, overdue, completed } = useBillsDashboardStats();

  useEffect(() => {
    if (!refetchRef) return;
    refetchRef.current = async () => {
      await Promise.all([refetchBills(), refetchRequests()]);
    };
    return () => {
      refetchRef.current = null;
    };
  }, [refetchRef, refetchBills, refetchRequests]);

  return (
    <>
      <BillsDashboardCarousel
        isLoading={isLoading}
        totalRecurringBills={totalRecurringBills}
        dueThisWeek={dueThisWeek}
        overdue={overdue}
        completed={completed}
      />
      <BillsTableSection />
    </>
  );
}
