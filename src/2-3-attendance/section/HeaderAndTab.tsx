import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, BarChart3, Settings } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

interface HeaderAndTabProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const HeaderAndTab = ({ activeTab, onTabChange }: HeaderAndTabProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppTranslation();

  const tabs = [
    {
      id: "dashboard",
      labelKey: "layout.attendanceModule.tabDashboard",
      labelDefault: "Dashboard",
      icon: BarChart3,
      route: "/attendance",
    },
    {
      id: "attendance",
      labelKey: "layout.attendanceModule.tabRecords",
      labelDefault: "Attendance",
      icon: CalendarDays,
      route: "/attendance/attendance",
    },
    {
      id: "settings",
      labelKey: "layout.attendanceModule.tabSettings",
      labelDefault: "Settings",
      icon: Settings,
      route: "/attendance/settings",
    },
  ];

  const getActiveTab = () => {
    if (location.pathname === "/attendance/settings") return "settings";
    if (location.pathname === "/attendance/attendance") return "attendance";
    return "dashboard";
  };

  const handleTabClick = (tab: (typeof tabs)[number]) => {
    onTabChange(tab.id);
    if (tab.route) {
      navigate(tab.route);
    }
  };

  const currentActiveTab = getActiveTab() || activeTab;

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="text-foreground mb-0.5 text-xl font-bold">
          {t("layout.attendanceModule.headerTitle", "Attendance management")}
        </h1>
        <p className="text-muted-foreground text-xs">
          {t("layout.attendanceModule.headerSubtitle", "Monitor attendance, insights, and settings")}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentActiveTab === tab.id || activeTab === tab.id;
            const label = t(tab.labelKey, tab.labelDefault);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = "HeaderAndTab";
