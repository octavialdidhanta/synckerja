import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, AlertTriangle } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentUserRole } from "@/shared/hooks/useCurrentUserRole";

interface HeaderAndTabProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const HR_MANAGEMENT_ROLES = new Set(["owner", "admin", "hr"]);

export const HeaderAndTab = ({ activeTab: _activeTab, onTabChange }: HeaderAndTabProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppTranslation();
  const { data: role, isPending } = useCurrentUserRole();

  const canAccessReprimand = useMemo(() => {
    if (isPending) return false;
    return !!role && HR_MANAGEMENT_ROLES.has(role);
  }, [isPending, role]);

  const tabs = useMemo(() => {
    const all = [
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
    ];
    return canAccessReprimand ? all : all.filter((tab) => tab.id !== "reprimand");
  }, [t, canAccessReprimand]);

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

            return (
              <div
                key={tab.id}
                role="button"
                tabIndex={0}
                onClick={() => handleTabClick(tab)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTabClick(tab);
                  }
                }}
                className={`flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-muted-foreground hover:border-brand-blue/30 hover:text-brand-blue"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = "HeaderAndTab";
