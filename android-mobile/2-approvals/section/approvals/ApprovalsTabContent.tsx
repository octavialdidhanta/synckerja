import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePurchaseRequests } from "@/9-request-form/hooks/usePurchaseRequests";
import type { ApprovalFiltersType } from "@/4-2-approvals/section/ApprovalFilters";
import {
  computeApprovalsMetricAmounts,
  computeApprovalsMetricCounts,
} from "@/4-2-approvals/utils/approvalUtils";
import { ExpenseDashboardRefreshContext } from "@/mobile/2-expense/ExpenseDashboardRefreshContext";
import { ApprovalsDashboardCarousel } from "@/mobile/2-approvals/section/approvals/ApprovalsDashboardCarousel";
import { ApprovalsTableSection } from "@/mobile/2-approvals/section/approvals/ApprovalsTableSection";

export function ApprovalsTabContent() {
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const { data: requests = [], isLoading, refetch } = usePurchaseRequests();

  const [filters, setFilters] = useState<ApprovalFiltersType>({
    search: "",
    status: "all",
    type: "all",
    department: "all",
  });

  const counts = useMemo(() => computeApprovalsMetricCounts(requests), [requests]);
  const amounts = useMemo(() => computeApprovalsMetricAmounts(requests), [requests]);

  const handleFilterChange = useCallback((key: keyof ApprovalFiltersType, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      status: "all",
      type: "all",
      department: "all",
    });
  }, []);

  useEffect(() => {
    if (!refetchRef) return;
    refetchRef.current = async () => {
      await refetch();
    };
    return () => {
      refetchRef.current = null;
    };
  }, [refetchRef, refetch]);

  return (
    <>
      <ApprovalsDashboardCarousel
        isLoading={isLoading}
        totalRequests={counts.totalRequests}
        pendingReview={counts.pendingReview}
        approved={counts.approved}
        recurring={counts.recurring}
        totalAmount={amounts.totalAmount}
        pendingAmount={amounts.pendingAmount}
        approvedAmount={amounts.approvedAmount}
        recurringAmount={amounts.recurringAmount}
      />
      <ApprovalsTableSection
        requests={requests}
        isLoading={isLoading}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />
    </>
  );
}
