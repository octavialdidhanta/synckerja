import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, AlertTriangle, Lock } from "lucide-react";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { prefetchAppRoute } from "@/shared/routing/prefetchAppRoute";

interface HeaderAndTabProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const HeaderAndTab = ({ activeTab: _activeTab, onTabChange }: HeaderAndTabProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();

  const tabs = useMemo(
    () => [
      {
        id: "employees",
        label: t("employees.header.tabEmployees", "Employee Management"),
        icon: Users,
        description: t("employees.header.tabEmployeesDescription", "Manage employee data, profiles, and information"),
        route: "/employees",
      },
      {
        id: "reprimand",
        label: t("employees.header.tabReprimand", "Reprimand"),
        icon: AlertTriangle,
        description: t(
          "employees.header.tabReprimandDescription",
          "Manage employee reprimands and disciplinary actions",
        ),
        route: "/employees/reprimand",
      },
    ],
    [t],
  );

  const handleTabClick = (tab: (typeof tabs)[number]) => {
    if (tab.route) {
      navigate(tab.route);
    } else {
      onTabChange(tab.id);
    }
  };

  const getActiveTab = () => {
    if (location.pathname === "/employees/reprimand") {
      return "reprimand";
    }
    if (location.pathname === "/employees") {
      return "employees";
    }
    return "employees";
  };

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">
          {t("employees.header.pageTitle", "Employee Management")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t(
            "employees.header.pageSubtitle",
            "Manage employee data, profiles, and organizational information",
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = getActiveTab() === tab.id;
            const locked = isTabLocked(tab.route);

            return (
              <div
                key={tab.id}
                role="button"
                tabIndex={0}
                onMouseEnter={() => tab.route && prefetchAppRoute(tab.route)}
                onFocus={() => tab.route && prefetchAppRoute(tab.route)}
                onClick={() => handleTabClick(tab)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTabClick(tab);
                  }
                }}
                title={
                  locked
                    ? t("accessDenied.message", "You do not have permission to view this page.")
                    : tab.description
                }
                className={cn(
                  "flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors",
                  locked
                    ? "border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "border-brand-blue text-brand-blue"
                      : "border-transparent text-muted-foreground hover:border-brand-blue/30 hover:text-brand-blue",
                )}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = "HeaderAndTab";
