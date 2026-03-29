import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HeaderAndTab } from "./section/HeaderAndTab";
import { DashboardOverview } from "@/2-3-dashboard";
import { EmployeeAttendanceTab } from "@/2-3-employee-attendance";
import { AttendanceSettings } from "@/2-3-settings";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  AttendanceModuleSkeleton,
  getAttendanceSkeletonVariant,
} from "./components/AttendanceSkeletons";

export const AttendancePage = () => {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccessPage, configLoading } = useDepartmentAccess();
  const { userRole, isOwner, isAdmin } = useCentralizedUserData();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentView, setCurrentView] = useState<"table" | "calendar">("table");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (location.pathname === "/attendance/settings") {
      setActiveTab("settings");
    } else if (location.pathname === "/attendance/attendance") {
      setActiveTab("attendance");
    } else if (location.pathname === "/attendance") {
      setActiveTab("dashboard");
    }
  }, [location.pathname]);

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

    const hasAccess = canAccessPage(currentPath);

    if (!hasAccess) {
      if (currentPath === "/attendance") {
        const hasAttendanceAccess = canAccessPage("/attendance/attendance");
        if (hasAttendanceAccess) {
          navigate("/attendance/attendance", { replace: true });
          return;
        }
      }

      if (currentPath === "/attendance/attendance") {
        const hasSettingsAccess = canAccessPage("/attendance/settings");
        if (hasSettingsAccess) {
          navigate("/attendance/settings", { replace: true });
          return;
        }
      }

      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  }, [location.pathname, canAccessPage, configLoading, isOwner, isAdmin, userRole, navigate]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleViewChange = useCallback((view: "table" | "calendar") => {
    setCurrentView(view);
  }, []);

  const showShellSkeleton = isLoading || configLoading;
  const skeletonVariant = getAttendanceSkeletonVariant(location.pathname);
  const loadingAria = t("layout.attendanceModule.loadingAria", "Loading attendance");

  return (
    <div className="bg-background relative flex min-h-0 min-w-0 flex-1 flex-col font-sans">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3",
          showShellSkeleton && "pointer-events-none invisible",
        )}
      >
        <div className="mb-1 shrink-0">
          <HeaderAndTab activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {activeTab === "dashboard" && (
            <div className="border-border bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-lg border p-4 shadow-sm">
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
            <div className="border-border bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-lg border p-4 shadow-sm">
              <AttendanceSettings />
            </div>
          )}
        </div>
      </div>

      {showShellSkeleton ? (
        <div
          className="absolute inset-0 z-10 overflow-auto bg-background"
          aria-busy="true"
          aria-label={loadingAria}
        >
          <AttendanceModuleSkeleton variant={skeletonVariant} />
        </div>
      ) : null}
    </div>
  );
};

export default AttendancePage;
