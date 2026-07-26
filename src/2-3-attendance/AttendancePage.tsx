import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { HeaderAndTab } from "./section/HeaderAndTab";
import { DashboardOverview } from "@/2-3-dashboard";
import { EmployeeAttendanceTab } from "@/2-3-employee-attendance";
import { AttendanceSettings } from "@/2-3-settings";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useModulePageOverlaySkeleton } from "@/shared/auth/page-access/useModulePageOverlaySkeleton";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  AttendanceModuleSkeleton,
  getAttendanceSkeletonVariant,
} from "./components/AttendanceSkeletons";
import {
  AttendancePageLoadProvider,
  useAttendancePageLoad,
} from "./context/AttendancePageLoadContext";

/** Must match routing + `HeaderAndTab.getActiveTab` — derived from URL so first paint never mounts the wrong tab. */
function attendanceTabFromPathname(pathname: string): "dashboard" | "attendance" | "settings" {
  if (pathname === "/attendance/settings") return "settings";
  if (pathname === "/attendance/attendance") return "attendance";
  return "dashboard";
}

function AttendancePageContent() {
  const { t } = useAppTranslation();
  const { hasPendingLoad } = useAttendancePageLoad();
  const location = useLocation();
  const { orgBootstrapPending } = useOrgBootstrapPending();

  const activeTab = attendanceTabFromPathname(location.pathname);
  const [settingsSkeletonVisible, setSettingsSkeletonVisible] = useState(true);
  /** After first settings paint, section switches must not re-cover the nav with a full-page skeleton. */
  const settingsEverReadyRef = useRef(false);

  /** Navigation is performed inside `HeaderAndTab` via `navigate()`; tab state is URL-derived. */
  const handleTabChange = useCallback((_tab: string) => {}, []);

  const isSettingsRoute = location.pathname === "/attendance/settings";
  const dataPending = hasPendingLoad || orgBootstrapPending;
  const { showFullPageSkeleton, accessReady } = useModulePageOverlaySkeleton(
    dataPending,
    location.pathname,
  );
  const rawLoading = !accessReady || showFullPageSkeleton;

  useEffect(() => {
    if (!isSettingsRoute) {
      settingsEverReadyRef.current = false;
      setSettingsSkeletonVisible(true);
      return;
    }

    if (rawLoading) {
      // Keep nav/selection visible when switching Shift Settings etc. — only block first entry.
      if (!settingsEverReadyRef.current) {
        setSettingsSkeletonVisible(true);
      }
      return;
    }

    const timer = window.setTimeout(() => {
      settingsEverReadyRef.current = true;
      setSettingsSkeletonVisible(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [isSettingsRoute, rawLoading]);

  /** Debounce clearing overlay so query / ref-counts settling in adjacent ticks do not flash content. */
  const shellReady = useDebouncedReady(!rawLoading, 220);
  const showShellSkeleton = isSettingsRoute ? settingsSkeletonVisible : !shellReady;
  const skeletonVariant = getAttendanceSkeletonVariant(location.pathname);
  const loadingAria = t("layout.attendanceModule.loadingAria", "Loading attendance");

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1 flex-col",
          showShellSkeleton && "pointer-events-none invisible",
        )}
      >
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <HeaderAndTab activeTab={activeTab} onTabChange={handleTabChange} />
                </div>
                <ModuleShellContentGate pagePath={location.pathname}>
                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    {activeTab === "dashboard" && (
                      <div className="border-border bg-card flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border p-4 shadow-sm">
                        <DashboardOverview />
                      </div>
                    )}

                    {activeTab === "attendance" && (
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <EmployeeAttendanceTab />
                      </div>
                    )}

                    {activeTab === "settings" && <AttendanceSettings />}
                  </div>
                </div>
                </ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showShellSkeleton ? (
        <div
          className="absolute inset-0 z-10 overflow-hidden bg-gray-100"
          aria-busy="true"
          aria-label={loadingAria}
        >
          <AttendanceModuleSkeleton variant={skeletonVariant} />
        </div>
      ) : null}
    </div>
  );
}

export const AttendancePage = () => (
  <AttendancePageLoadProvider>
    <AttendancePageContent />
  </AttendancePageLoadProvider>
);

export default AttendancePage;
