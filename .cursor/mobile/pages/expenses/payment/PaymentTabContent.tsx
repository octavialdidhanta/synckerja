import { useContext, useEffect } from "react";
import { usePaymentDashboardStats } from "@/mobile/pages/expenses/payment/hooks/usePaymentDashboardStats";
import { PaymentDashboardCarousel } from "@/mobile/pages/expenses/payment/section/PaymentDashboardCarousel";
import { PaymentTableSection } from "@/mobile/pages/expenses/payment/section/PaymentTableSection";
import { usePurchaseRequests } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { ExpenseDashboardRefreshContext } from "@/mobile/pages/expenses/ExpenseDashboardRefreshContext";

export function PaymentTabContent() {
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const { refetch } = usePurchaseRequests();
  const { isLoading, readyToPay, pendingPayment, paid, processing } = usePaymentDashboardStats();

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
      <PaymentDashboardCarousel
        isLoading={isLoading}
        readyToPay={readyToPay}
        pendingPayment={pendingPayment}
        paid={paid}
        processing={processing}
      />
      <PaymentTableSection />
    </>
  );
}
