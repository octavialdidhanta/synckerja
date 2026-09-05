import { BarChart3, GitCompareArrows } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { DashboardTab } from "../shared/lib/dashboardUrlState";

export function OperationsDashboardHeaderAndTab() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab: DashboardTab = searchParams.get("tab") === "comparison"
    ? "comparison"
    : "summary";
  const title = t("operationsDashboard.header.title", "Dashboard");
  const description = t(
    "operationsDashboard.header.subtitle",
    "Performance overview across sales, profit, items, and outlets.",
  );
  const tabs: Array<{
    id: DashboardTab;
    label: string;
    icon: typeof BarChart3;
  }> = [
    {
      id: "summary",
      label: t("operationsDashboard.tabs.summary", "Summary"),
      icon: BarChart3,
    },
    {
      id: "comparison",
      label: t("operationsDashboard.tabs.comparison", "Outlet Comparison"),
      icon: GitCompareArrows,
    },
  ];

  const selectTab = (tab: DashboardTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    navigate({ pathname: location.pathname, search: next.toString() });
  };

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <nav className="-mb-3 flex flex-wrap gap-x-6 gap-y-1" aria-label={title}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(tab.id)}
              className={`flex items-center gap-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

OperationsDashboardHeaderAndTab.displayName = "OperationsDashboardHeaderAndTab";
