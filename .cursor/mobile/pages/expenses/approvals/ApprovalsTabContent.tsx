import { useContext, useEffect } from "react";
import { useApprovalsDashboardStats } from "@/mobile/pages/expenses/approvals/hooks/useApprovalsDashboardStats";
import { ApprovalsDashboardCarousel } from "@/mobile/pages/expenses/approvals/section/ApprovalsDashboardCarousel";
import { ApprovalsTableSection } from "@/mobile/pages/expenses/approvals/section/ApprovalsTableSection";
import { usePurchaseRequests } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { ExpenseDashboardRefreshContext } from "@/mobile/pages/expenses/ExpenseDashboardRefreshContext";

export function ApprovalsTabContent() {
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const { refetch } = usePurchaseRequests();
  const { isLoading, totalRequests, pendingReview, approved, recurring } = useApprovalsDashboardStats();

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
        totalRequests={totalRequests}
        pendingReview={pendingReview}
        approved={approved}
        recurring={recurring}
      />
      <ApprovalsTableSection />
    </>
  );
}
