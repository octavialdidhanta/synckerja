import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, Network, Package } from "lucide-react";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type CompanyHeaderAndTabsProps = {
  /** @deprecated Tab state is derived from the URL */
  activeTab?: string;
  onTabChange?: (tab: string) => void;
};

export function CompanyHeaderAndTabs({ onTabChange }: CompanyHeaderAndTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessPage } = useDepartmentAccess();
  const { t } = useAppTranslation();

  const tabs = [
    {
      id: "dashboard",
      labelKey: "company.tabs.dashboard",
      labelFallback: "Dashboard",
      icon: LayoutDashboard,
      route: "/company/dashboard",
    },
    {
      id: "company-assets",
      labelKey: "company.tabs.companyAssets",
      labelFallback: "Company Assets",
      icon: Package,
      route: "/company/company-assets",
    },
    {
      id: "files",
      labelKey: "company.tabs.files",
      labelFallback: "Files",
      icon: FileText,
      route: "/company/files",
    },
    {
      id: "organization",
      labelKey: "company.tabs.organization",
      labelFallback: "Organization",
      icon: Network,
      route: "/company/organization",
    },
  ];

  const handleTabClick = useCallback(
    (tab: (typeof tabs)[0]) => {
      if (tab.route && canAccessPage(tab.route)) {
        navigate(tab.route);
      } else {
        onTabChange?.(tab.id);
      }
    },
    [canAccessPage, navigate, onTabChange],
  );

  const getActiveTabId = () => {
    const path = location.pathname;
    if (path === "/company/dashboard") return "dashboard";
    if (path === "/company/company-assets") return "company-assets";
    if (path === "/company/files") return "files";
    if (path === "/company/organization") return "organization";
    return "dashboard";
  };

  const activeTabId = getActiveTabId();

  return (
    <div className="dashboard-header-tab-wrapper ml-0 py-3 pl-2">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">
          {t("company.page.title", "Company")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t("company.page.subtitle", "Profile, assets, files, and organization")}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label={t("company.page.tabsAria", "Company sections")}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            const canAccess = canAccessPage(tab.route);
            const label = t(tab.labelKey, tab.labelFallback);

            return (
              <button
                key={tab.id}
                type="button"
                disabled={!canAccess}
                onClick={() => canAccess && handleTabClick(tab)}
                className={`flex items-center gap-1.5 border-b-2 py-1.5 px-1 text-sm font-medium transition-colors ${
                  canAccess
                    ? isActive
                      ? "cursor-pointer border-primary text-primary"
                      : "cursor-pointer border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                    : "cursor-not-allowed border-transparent text-muted-foreground opacity-50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
