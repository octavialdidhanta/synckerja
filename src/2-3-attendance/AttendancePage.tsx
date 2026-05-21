import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HeaderAndTab } from "./section/HeaderAndTab";
import { DashboardOverview } from "@/2-3-dashboard";
import { EmployeeAttendanceTab } from "@/2-3-employee-attendance";
import { AttendanceSettings } from "@/2-3-settings";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
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
  const navigate = useNavigate();
  const { canAccessPage, configLoading } = useDepartmentAccess();
  const { userRole, isOwner, isAdmin } = useCentralizedUserData();
  const { orgBootstrapPending } = useOrgBootstrapPending();

  const activeTab = attendanceTabFromPathname(location.pathname);
  const [currentView, setCurrentView] = useState<"table" | "calendar">("table");
  const [isLoading, setIsLoading] = useState(true);
  const [settingsSkeletonVisible, setSettingsSkeletonVisible] = useState(true);

  useEffect(() => {
    if (configLoading) {
      setIsLoading(true);
      return;
    }

    const currentPath = location.pathname;

    if (isOwner || userRole === "owner" || isAdmin || userRole === "admin") {
      setIsLoading(false);
      return;
    }

    if (canAccessPage(currentPath)) {
      setIsLoading(false);
      return;
    }

    const fallbackPath =
      currentPath === "/attendance"
        ? canAccessPage("/attendance/attendance")
          ? "/attendance/attendance"
          : canAccessPage("/attendance/settings")
            ? "/attendance/settings"
            : null
        : currentPath === "/attendance/attendance" && canAccessPage("/attendance/settings")
          ? "/attendance/settings"
          : null;

    if (fallbackPath && fallbackPath !== currentPath) {
      navigate(fallbackPath, { replace: true });
      return;
    }

    setIsLoading(false);
  }, [location.pathname, canAccessPage, configLoading, isOwner, isAdmin, userRole, navigate]);

  /** Navigation is performed inside `HeaderAndTab` via `navigate()`; tab state is URL-derived. */
  const handleTabChange = useCallback((_tab: string) => {}, []);

  const handleViewChange = useCallback((view: "table" | "calendar") => {
    setCurrentView(view);
  }, []);

  const isSettingsRoute = location.pathname === "/attendance/settings";
  const recordsRoute = location.pathname === "/attendance/attendance";
  /** Records tab: wait for org context + section ref-counts; avoids one frame without overlay before table/sidebar report load. */
  const rawLoading =
    isLoading || configLoading || hasPendingLoad || (recordsRoute && orgBootstrapPending);

  useEffect(() => {
    if (!isSettingsRoute) {
      setSettingsSkeletonVisible(true);
      return;
    }

    if (rawLoading) {
      setSettingsSkeletonVisible(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setSettingsSkeletonVisible(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [isSettingsRoute, rawLoading]);

  /** Debounce clearing overlay on records route so query `isPending` / ref-counts settling in adjacent ticks do not flash content. */
  const recordsShellReady = useDebouncedReady(!rawLoading, 220);
  const showShellSkeleton = isSettingsRoute
    ? settingsSkeletonVisible
    : recordsRoute
      ? !recordsShellReady
      : rawLoading;
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
                <div
                  className={cn(
                    "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch",
                    "[@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none",
                    "[@media(max-height:760px)]:min-h-[700px]",
                  )}
                >
                  <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    {activeTab === "dashboard" && (
                      <div className="border-border bg-card flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border p-4 shadow-sm">
                        <DashboardOverview />
                      </div>
                    )}

                    {activeTab === "attendance" && (
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <EmployeeAttendanceTab
                          currentView={currentView}
                          onViewChange={handleViewChange}
                        />
                      </div>
                    )}

                    {activeTab === "settings" && (
                      <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
                        <AttendanceSettings />
                      </div>
                    )}
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
      </div>

      {showShellSkeleton ? (
        <div
          className="absolute inset-0 z-10 overflow-hidden bg-gray-100"
          aria-busy="true"
          aria-label={loadingAria}
        >
          <AttendanceModuleSkeleton variant={skeletonVariant} recordsView={currentView} />
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
