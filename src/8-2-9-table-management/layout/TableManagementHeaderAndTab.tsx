import { LayoutGrid, Lock, Map, BarChart3 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  TABLE_MANAGEMENT_GROUP_PATH,
  TABLE_MANAGEMENT_MAP_PATH,
  TABLE_MANAGEMENT_REPORT_PATH,
  tableManagementTabFromPathname,
  tableManagementTabLocation,
  type TableManagementSubTab,
} from "./tableManagementTabs";

const tabs: Array<{
  id: TableManagementSubTab;
  path: string;
  titleKey: string;
  fallbackTitle: string;
  icon: typeof LayoutGrid;
}> = [
  {
    id: "group",
    path: TABLE_MANAGEMENT_GROUP_PATH,
    titleKey: "tableManagement.tab.group",
    fallbackTitle: "Table Group",
    icon: LayoutGrid,
  },
  {
    id: "map",
    path: TABLE_MANAGEMENT_MAP_PATH,
    titleKey: "tableManagement.tab.map",
    fallbackTitle: "Table Map",
    icon: Map,
  },
  {
    id: "report",
    path: TABLE_MANAGEMENT_REPORT_PATH,
    titleKey: "tableManagement.tab.report",
    fallbackTitle: "Table Report",
    icon: BarChart3,
  },
];

export function TableManagementHeaderAndTab() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const activeTab = tableManagementTabFromPathname(location.pathname);

  const title = t("tableManagement.header.title", "Table Management");
  const description = t(
    "tableManagement.header.subtitle",
    "Group tables by area, map floor plans, and review table reports.",
  );

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label={title}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const locked = isTabLocked(tab.path);
            const label = t(tab.titleKey, tab.fallbackTitle);

            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => {
                  if (locked) return;
                  navigate(tableManagementTabLocation(tab.path, location.search));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (locked) return;
                    navigate(tableManagementTabLocation(tab.path, location.search));
                  }
                }}
                className={`flex items-center space-x-1.5 px-1 py-1.5 text-sm font-medium transition-colors ${
                  locked
                    ? "cursor-not-allowed border-b-2 border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "cursor-pointer border-b-2 border-primary text-primary"
                      : "cursor-pointer border-b-2 border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                title={
                  locked
                    ? t("tableManagement.header.noAccess", "You do not have access to this page")
                    : label
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5" /> : null}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

TableManagementHeaderAndTab.displayName = "TableManagementHeaderAndTab";
