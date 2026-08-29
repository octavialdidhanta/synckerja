import { BarChart3, FileText, Lock, Receipt, Vault } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  REPORTS_INVOICES_PATH,
  REPORTS_SALES_SUMMARY_PATH,
  REPORTS_SHIFT_PATH,
  REPORTS_TRANSACTIONS_PATH,
  reportsTabFromPathname,
  reportsTabLocation,
  type ReportsSubTab,
} from "./reportsTabs";

const tabs: Array<{
  id: ReportsSubTab;
  path: string;
  titleKey: string;
  fallbackTitle: string;
  icon: typeof BarChart3;
}> = [
  {
    id: "sales",
    path: REPORTS_SALES_SUMMARY_PATH,
    titleKey: "reports.tab.sales",
    fallbackTitle: "Sales",
    icon: BarChart3,
  },
  {
    id: "transactions",
    path: REPORTS_TRANSACTIONS_PATH,
    titleKey: "reports.tab.transactions",
    fallbackTitle: "Transactions",
    icon: Receipt,
  },
  {
    id: "invoices",
    path: REPORTS_INVOICES_PATH,
    titleKey: "reports.tab.invoices",
    fallbackTitle: "Invoices",
    icon: FileText,
  },
  {
    id: "shift",
    path: REPORTS_SHIFT_PATH,
    titleKey: "reports.tab.shift",
    fallbackTitle: "Shift",
    icon: Vault,
  },
];

export function ReportsHeaderAndTab() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const activeTab = reportsTabFromPathname(location.pathname);

  const title = t("reports.header.title", "Reports");
  const description = t(
    "reports.header.subtitle",
    "Review sales, transactions, invoices, and shift performance.",
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
                  navigate(reportsTabLocation(tab.path, location.search));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (locked) return;
                    navigate(reportsTabLocation(tab.path, location.search));
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
                    ? t("reports.header.noAccess", "You do not have access to this page")
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

ReportsHeaderAndTab.displayName = "ReportsHeaderAndTab";
