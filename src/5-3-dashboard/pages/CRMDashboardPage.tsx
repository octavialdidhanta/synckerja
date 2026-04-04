import React, { useEffect, useRef, useState } from "react";
import { HeaderAndTab } from "@/5-3-dashboard/components/layout/HeaderAndTab";
import { CRMDashboardContent } from "@/5-3-dashboard/components/crm/CRMDashboardContent";
import { ConsultantCrmDashboardPageSkeleton } from "@/5-3-dashboard/skeletons/ConsultantCrmDashboardPageSkeleton";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useLeads } from "@/shared/hooks/organized/sales";
import { cn } from "@/shared/lib/utils";

const SKELETON_HIDE_DEBOUNCE_MS = 200;

/**
 * /operations/consultant/dashboard — Seamless Page Scroll Layout (see `.cursor/rules/Seamless Page Scroll Layout.mdc`).
 * Parent `AppShellLayout` already scrolls: root uses `h-full min-h-0 flex-1 overflow-hidden` (not `h-screen`).
 * HeaderAndTab lives inside the main scroll container so it scrolls with content; `scrollbar-hide` + hard-hide fallbacks on that container.
 *
 * Single layout-matched skeleton overlay (Loading Skeleton rule): covers header, tabs, and content until org + leads are ready.
 */
export const CRMDashboardPage = () => {
  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const { initialLoadPending: leadsPending } = useLeads();

  const dataPending = orgLoading || (!!organizationId && leadsPending);

  const [showSkeletonOverlay, setShowSkeletonOverlay] = useState(true);
  const sawDataPendingRef = useRef(false);

  useEffect(() => {
    if (dataPending) {
      sawDataPendingRef.current = true;
      setShowSkeletonOverlay(true);
      return;
    }
    const delay = sawDataPendingRef.current ? SKELETON_HIDE_DEBOUNCE_MS : 0;
    const t = window.setTimeout(() => {
      requestAnimationFrame(() => setShowSkeletonOverlay(false));
    }, delay);
    return () => window.clearTimeout(t);
  }, [dataPending]);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3",
          showSkeletonOverlay && "invisible pointer-events-none",
        )}
        aria-hidden={showSkeletonOverlay}
      >
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
                  <div className="box-border min-w-0 w-full max-w-4xl shrink-0 self-start overflow-x-auto rounded-lg border border-surface-border bg-card p-4 shadow-sm">
                    <CRMDashboardContent />
                  </div>
                </div>
              </div>

              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>

      {showSkeletonOverlay ? (
        <div className="absolute inset-0 z-10 min-h-0 min-w-0 overflow-hidden bg-surface-muted">
          <ConsultantCrmDashboardPageSkeleton />
        </div>
      ) : null}
    </div>
  );
};
