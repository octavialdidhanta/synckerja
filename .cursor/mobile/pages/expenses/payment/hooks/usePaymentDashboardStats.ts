import { useMemo } from "react";
import { usePurchaseRequests } from "@/features/9_request-form/hooks/usePurchaseRequests";

export function usePaymentDashboardStats() {
  const { data: requests = [], isLoading } = usePurchaseRequests();

  const readyToPay = useMemo(
    () => requests.filter((req) => req.status === "approved" && !req.paid_at).length,
    [requests]
  );
  const pendingPayment = useMemo(
    () => requests.filter((req) => req.status === "approved" && !req.paid_at && req.payment_status !== "processing").length,
    [requests]
  );
  const paid = useMemo(
    () => requests.filter((req) => req.paid_at).length,
    [requests]
  );
  const processing = useMemo(
    () => requests.filter((req) => req.status === "approved" && req.payment_status === "processing").length,
    [requests]
  );

  return {
    isLoading,
    readyToPay,
    pendingPayment,
    paid,
    processing,
  };
}
