import { Lock, MessageSquareText, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export const CUSTOMERS_LIST_PATH = "/operations/customers-list";
export const CUSTOMERS_FEEDBACK_PATH = "/operations/customers-feedback";

export type CustomersSubTab = "list" | "feedback";

export function customersTabFromPathname(pathname: string): CustomersSubTab {
  if (pathname.startsWith(CUSTOMERS_FEEDBACK_PATH)) return "feedback";
  if (pathname.startsWith(CUSTOMERS_LIST_PATH)) return "list";
  return "list";
}

export function customersTabPath(tab: CustomersSubTab): string {
  if (tab === "feedback") return CUSTOMERS_FEEDBACK_PATH;
  return CUSTOMERS_LIST_PATH;
}

export function customersTabLocation(path: string, search: string): { pathname: string; search: string } {
  return { pathname: path, search };
}

const tabs: Array<{
  id: CustomersSubTab;
  path: string;
  titleKey: string;
  fallbackTitle: string;
  icon: typeof Users;
}> = [
  {
    id: "list",
    path: CUSTOMERS_LIST_PATH,
    titleKey: "customers.tab.list",
    fallbackTitle: "Customers List",
    icon: Users,
  },
  {
    id: "feedback",
    path: CUSTOMERS_FEEDBACK_PATH,
    titleKey: "customers.tab.feedback",
    fallbackTitle: "Feedback",
    icon: MessageSquareText,
  },
];

export function CustomersHeaderAndTab() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const activeTab = customersTabFromPathname(location.pathname);

  const title = t("customers.header.title", "Customers");
  const description = t(
    "customers.header.subtitle",
    "Manage customer records for POS and sales operations",
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
                  navigate(customersTabLocation(tab.path, location.search));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (locked) return;
                    navigate(customersTabLocation(tab.path, location.search));
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
                    ? t("customers.header.noAccess", "You do not have access to this page")
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

CustomersHeaderAndTab.displayName = "CustomersHeaderAndTab";
