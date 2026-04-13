import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePurchaseRequests } from "@/9-request-form/hooks/usePurchaseRequests";
import type { ApprovalFiltersType } from "@/4-2-approvals/section/ApprovalFilters";
import {
  computeApprovalsMetricAmounts,
  computeApprovalsMetricCounts,
} from "@/4-2-approvals/utils/approvalUtils";
import { ExpenseDashboardRefreshContext } from "@/mobile/2-expense/ExpenseDashboardRefreshContext";
import { ApprovalsDashboardCarousel } from "@/mobile/2-approvals/section/approvals/ApprovalsDashboardCarousel";
import { ApprovalsTableSection } from "@/mobile/2-approvals/section/approvals/ApprovalsTableSection";
import { MobileApprovalsFullViewportOverlay } from "@/mobile/2-approvals/pages/MobileApprovalsPageSkeleton";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { cn } from "@/shared/lib/utils";

const SKELETON_MIN_MS = 200;

export function ApprovalsTabContent() {
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const isRefreshing = refreshContext?.isRefreshing ?? false;
  const { data: requests = [], isPending, isLoading, refetch } = usePurchaseRequests();
  const { organizationId, loading: orgContextLoading } = useCurrentOrg();
  const { loading: userLoading } = useCurrentUser();
  const hasOrg = Boolean(organizationId);

  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevPendingRef = useRef(false);

  const queriesPending = hasOrg && (isPending || isLoading);

  /**
   * Keep approvals skeleton visible until first completed fetch for active org.
   * Prevents early skeleton hide between org bootstrap and query settle.
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
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col gap-1",
          showPageSkeleton && "pointer-events-none invisible",
        )}
      >
        <div className="shrink-0">
          <ApprovalsDashboardCarousel
            isLoading={false}
            totalRequests={counts.totalRequests}
            pendingReview={counts.pendingReview}
            approved={counts.approved}
            recurring={counts.recurring}
            totalAmount={amounts.totalAmount}
            pendingAmount={amounts.pendingAmount}
            approvedAmount={amounts.approvedAmount}
            recurringAmount={amounts.recurringAmount}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ApprovalsTableSection
            requests={requests}
            isLoading={false}
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

      {showPageSkeleton &&
        typeof document !== "undefined" &&
        createPortal(<MobileApprovalsFullViewportOverlay />, document.body)}
    </>
  );
}
