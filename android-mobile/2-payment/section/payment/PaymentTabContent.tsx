import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePurchaseRequests } from "@/9-request-form/hooks/usePurchaseRequests";
import type { PaymentFiltersType } from "@/4-2-payment-process/section/PaymentFilters";
import { computePaymentMetricStats } from "@/4-2-payment-process/utils/paymentUtils";
import { ExpenseDashboardRefreshContext } from "@/mobile/2-expense/ExpenseDashboardRefreshContext";
import { PaymentDashboardCarousel } from "@/mobile/2-payment/section/payment/PaymentDashboardCarousel";
import {
  MOBILE_DEFAULT_FILTERS,
  PaymentTableSection,
} from "@/mobile/2-payment/section/payment/PaymentTableSection";

export function PaymentTabContent() {
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const { data: requests = [], isLoading, refetch } = usePurchaseRequests();

  const [filters, setFilters] = useState<PaymentFiltersType>(MOBILE_DEFAULT_FILTERS);

  const stats = useMemo(() => computePaymentMetricStats(requests), [requests]);

  const handleFilterChange = useCallback((key: keyof PaymentFiltersType, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ ...MOBILE_DEFAULT_FILTERS });
  }, []);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

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
        readyToPay={stats.readyToPay}
        pendingPayment={stats.pendingPayment}
        paid={stats.paid}
        processing={stats.processing}
        readyToPayAmount={stats.readyToPayAmount}
        pendingPaymentAmount={stats.pendingPaymentAmount}
        paidAmount={stats.paidAmount}
        processingAmount={stats.processingAmount}
      />
      <PaymentTableSection
        requests={requests}
        isLoading={isLoading}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onRefresh={handleRefresh}
      />
    </>
  );
}
