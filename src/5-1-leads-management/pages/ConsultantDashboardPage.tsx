import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConsultantsPageContent } from "@/5-3-dashboard/components/consultants/ConsultantsPageContent";
import { HeaderAndTab } from "@/5-3-dashboard/components/layout/HeaderAndTab";
import { useLeadsManagementFilterQueries } from "@/5-3-dashboard/hooks/useLeadsManagementFilterQueries";
import { useAvailableEmployees } from "@/shared/hooks/useAvailableEmployees";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useLeads } from "@/shared/hooks/organized/sales";
import { LeadsManagementPageSkeleton } from "@/5-1-leads-management/skeletons/LeadsManagementPageSkeleton";
import { cn } from "@/shared/lib/utils";

/**
 * /operations/consultant/leads-management — Seamless Page Scroll Layout
 * (`.cursor/rules/Seamless Page Scroll Layout.mdc`).
 * One layout-matched skeleton overlay until org + leads + employees + filter metadata are ready
 * (`.cursor/rules/Loading Skeleton.mdc`).
 *
 * Anti-flicker on reload:
 * - Use `initialLoadPending` from leads (first fetch / employee gate), not only `isLoading`.
 * - Reveal main content with `opacity: 0` under the overlay (compositing) then instant `opacity: 1` when ready (no fade that would flash empty).
 * - Defer removing the overlay with double rAF after data is ready so the browser can commit layout first.
 */
export const ConsultantDashboardPage = () => {
  const [searchParams] = useSearchParams();
  const isReportView = searchParams.get("view") === "report";

  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const { initialLoadPending: leadsInitialPending } = useLeads({ scope: "all" });
  const employeesQuery = useAvailableEmployees();
  const { metadataPending } = useLeadsManagementFilterQueries();

  const employeesInitialPending =
    Boolean(organizationId) &&
    (employeesQuery.isPending ||
      (employeesQuery.isFetching && employeesQuery.dataUpdatedAt === 0));

  const rawPending =
    orgLoading ||
    (Boolean(organizationId) &&
      (leadsInitialPending || employeesInitialPending || metadataPending));

  const [showOverlay, setShowOverlay] = useState(true);
  const revealRafOuterRef = useRef<number | null>(null);
  const revealRafInnerRef = useRef<number | null>(null);
  const hideOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rawPending) {
      if (revealRafOuterRef.current != null) {
        cancelAnimationFrame(revealRafOuterRef.current);
        revealRafOuterRef.current = null;
      }
      if (revealRafInnerRef.current != null) {
        cancelAnimationFrame(revealRafInnerRef.current);
        revealRafInnerRef.current = null;
      }
      if (hideOverlayTimeoutRef.current != null) {
        clearTimeout(hideOverlayTimeoutRef.current);
        hideOverlayTimeoutRef.current = null;
      }
      setShowOverlay(true);
      return;
    }

    // Small debounce avoids 1-frame flash when multiple queries
    // settle across adjacent ticks after a hard reload.
    hideOverlayTimeoutRef.current = setTimeout(() => {
      hideOverlayTimeoutRef.current = null;
      revealRafOuterRef.current = requestAnimationFrame(() => {
        revealRafInnerRef.current = requestAnimationFrame(() => {
          revealRafOuterRef.current = null;
          revealRafInnerRef.current = null;
          setShowOverlay(false);
        });
      });
    }, 200);

    return () => {
      if (hideOverlayTimeoutRef.current != null) {
        clearTimeout(hideOverlayTimeoutRef.current);
        hideOverlayTimeoutRef.current = null;
      }
      if (revealRafOuterRef.current != null) {
        cancelAnimationFrame(revealRafOuterRef.current);
        revealRafOuterRef.current = null;
      }
      if (revealRafInnerRef.current != null) {
        cancelAnimationFrame(revealRafInnerRef.current);
        revealRafInnerRef.current = null;
      }
    };
  }, [rawPending]);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain relative flex h-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className={cn(
                "flex min-h-full min-w-0 flex-col",
                showOverlay ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            >
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
                  <ConsultantsPageContent />
                </div>
              </div>

              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>

            {showOverlay && (
              <div className="absolute inset-0 z-10 min-h-full bg-surface-muted">
                <LeadsManagementPageSkeleton
                  mode="embedded"
                  variant={isReportView ? "report" : "default"}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
