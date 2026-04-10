import { useMemo } from "react";
import { usePurchaseRequests } from "@/features/9_request-form/hooks/usePurchaseRequests";

export function useApprovalsDashboardStats() {
  const { data: requests = [], isLoading } = usePurchaseRequests();

  const totalRequests = requests.length;
  const pendingReview = useMemo(
    () => requests.filter((req) => req.status === "pending_approval" || req.status === "submitted").length,
    [requests]
  );
  const approved = useMemo(
    () => requests.filter((req) => req.status === "approved").length,
    [requests]
  );
  const recurring = useMemo(
    () => requests.filter((req) => req.is_recurring).length,
    [requests]
  );

  return {
    isLoading,
    totalRequests,
    pendingReview,
    approved,
    recurring,
  };
}
