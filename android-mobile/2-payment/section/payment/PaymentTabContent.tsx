import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePurchaseRequests } from "@/9-request-form/hooks/usePurchaseRequests";
import type { PaymentFiltersType } from "@/4-2-payment-process/section/PaymentFilters";
import { computePaymentMetricStats } from "@/4-2-payment-process/utils/paymentUtils";
import { ExpenseDashboardRefreshContext } from "@/mobile/2-expense/ExpenseDashboardRefreshContext";
import { PaymentDashboardCarousel } from "@/mobile/2-payment/section/payment/PaymentDashboardCarousel";
import {
  MOBILE_DEFAULT_FILTERS,
  PaymentTableSection,
} from "@/mobile/2-payment/section/payment/PaymentTableSection";
import { MobilePaymentProcessFullViewportOverlay } from "@/mobile/2-payment/pages/MobilePaymentProcessPageSkeleton";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { useDebtsForExpense } from "@/shared/hooks/finance/useDebtsForExpense";
import { useBankAccounts } from "@/shared/hooks/finance/useBankAccounts";
import { useBankAccountBalances } from "@/shared/hooks/finance/useBankAccountBalances";
import { cn } from "@/shared/lib/utils";

const SKELETON_MIN_MS = 200;

export function PaymentTabContent() {
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const isRefreshing = refreshContext?.isRefreshing ?? false;
  const { data: requests = [], isPending, isLoading, refetch } = usePurchaseRequests();
  const { organizationId, loading: orgContextLoading } = useCurrentOrg();
  const { loading: userLoading } = useCurrentUser();
  const hasOrg = Boolean(organizationId);
  const { isLoading: debtsForExpenseLoading } = useDebtsForExpense();
  const { loading: bankAccountsLoading, isPending: bankAccountsPending } = useBankAccounts();
  const {
    loading: bankBalancesLoading,
    isPending: bankBalancesPending,
  } = useBankAccountBalances();

  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevPendingRef = useRef(false);

  const queriesPending =
    hasOrg &&
    (isPending ||
      isLoading ||
      debtsForExpenseLoading ||
      bankAccountsLoading ||
      bankAccountsPending ||
      bankBalancesLoading ||
      bankBalancesPending);

  /**
   * Keep page skeleton until first completed fetch cycle for active organization.
   * Prevents "ready" flicker when auth/org bootstrap finishes before all queries settle.
   */
  const [initialOrgSettled, setInitialOrgSettled] = useState(false);
  const settledOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (orgContextLoading || userLoading) return;

    if (!hasOrg) {
      settledOrgIdRef.current = null;
      setInitialOrgSettled(true);
      return;
    }

    if (settledOrgIdRef.current !== organizationId) {
      settledOrgIdRef.current = null;
      setInitialOrgSettled(false);
    }
  }, [hasOrg, organizationId, orgContextLoading, userLoading]);

  useEffect(() => {
    if (orgContextLoading || userLoading || !hasOrg) return;
    if (queriesPending) return;

    settledOrgIdRef.current = organizationId;
    setInitialOrgSettled(true);
  }, [hasOrg, organizationId, orgContextLoading, userLoading, queriesPending]);

  const dataPending = orgContextLoading || userLoading || !initialOrgSettled || queriesPending;

  useEffect(() => {
    const pending = dataPending;
    const wasPending = prevPendingRef.current;
    prevPendingRef.current = pending;

    if (pending) {
      if (skeletonShownAtRef.current == null) skeletonShownAtRef.current = Date.now();
      setMinSettleDone(false);
      return;
    }

    if (wasPending && skeletonShownAtRef.current != null) {
      const elapsed = Date.now() - skeletonShownAtRef.current;
      const remaining = Math.max(0, SKELETON_MIN_MS - elapsed);
      const tId = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setMinSettleDone(true);
            skeletonShownAtRef.current = null;
          });
        });
      }, remaining);
      return () => window.clearTimeout(tId);
    }

    skeletonShownAtRef.current = null;
    setMinSettleDone(true);
  }, [dataPending]);

  const showPageSkeleton = (dataPending || !minSettleDone) && !isRefreshing;

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
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col gap-1",
          showPageSkeleton && "pointer-events-none invisible",
        )}
      >
        <div className="shrink-0">
          <PaymentDashboardCarousel
            isLoading={false}
            readyToPay={stats.readyToPay}
            pendingPayment={stats.pendingPayment}
            paid={stats.paid}
            processing={stats.processing}
            readyToPayAmount={stats.readyToPayAmount}
            pendingPaymentAmount={stats.pendingPaymentAmount}
            paidAmount={stats.paidAmount}
            processingAmount={stats.processingAmount}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PaymentTableSection
            requests={requests}
            isLoading={false}
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            onRefresh={handleRefresh}
          />
        </div>
      </div>

      {showPageSkeleton &&
        typeof document !== "undefined" &&
        createPortal(<MobilePaymentProcessFullViewportOverlay />, document.body)}
    </>
  );
}
