import { memo, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wallet, CheckCircle2, CreditCard, ReceiptText } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import { EXPENSE_TAB_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

export type ExpenseTabKey = "dashboard" | "debt" | "approvals" | "payment" | "bills";

const TABS: Record<ExpenseTabKey, string> = {
  dashboard: "/expenses/dashboard",
  debt: "/expenses/debt",
  approvals: "/expenses/approvals",
  payment: "/expenses/payment-process",
  bills: "/expenses/reminder-bills",
};

const expenseTabPressable =
  "touch-manipulation select-none rounded-md transition-[color,transform,background-color] duration-150 ease-out active:scale-[0.96] active:bg-muted/80";

const tabItems: { key: ExpenseTabKey; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "debt", icon: Wallet },
  { key: "approvals", icon: CheckCircle2 },
  { key: "payment", icon: CreditCard },
  { key: "bills", icon: ReceiptText },
];

export interface ExpenseBottomTabsProps {
  activeTab: ExpenseTabKey;
  onTabChange: (tab: ExpenseTabKey) => void;
  className?: string;
}

const ExpenseBottomTabsComponent = ({
  activeTab,
  onTabChange,
  className,
}: ExpenseBottomTabsProps) => {
  const { t } = useAppTranslation();

  /**
   * Selalu render: `useRegisterMobileAppNavSuppression` + depth bisa tertinggal (dialog/portal),
   * yang sebelumnya membuat `return null` dan footer hilang permanen. Modal fullscreen (z-50)
   * tetap menutupi tab (z-30); `html[data-mobile-shell-nav-suppressed]` hanya untuk CSS modal.
   */
  const labels: Record<ExpenseTabKey, string> = {
    dashboard: t("expenses.tabs.dashboard", "Dashboard"),
    debt: t("expenses.tabs.debt", "Debt"),
    approvals: t("expenses.tabs.approvals", "Approvals"),
    payment: t("expenses.tabs.payment", "Payment"),
    bills: t("expenses.tabs.bills", "Bills"),
  };

  /**
   * `mobile-app-bottom-nav`: Android native CSS menerapkan `--footer-bottom-inset` pada `<nav>`.
   * Kelas pada grid hanya untuk web/non-native.
   */
  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card safe-area-bottom-lower">
      <div
        className={cn(
          "mx-auto grid min-h-[52px] w-full max-w-md grid-cols-5",
          className,
        )}
      >
        {tabItems.map(({ key, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <MobileNavTabButton
              key={key}
              pagePath={EXPENSE_TAB_PAGE_PATH[key]}
              label={labels[key]}
              icon={Icon}
              isActive={isActive}
              onActivate={() => onTabChange(key)}
              className={expenseTabPressable}
              labelClassName="text-center text-xs font-medium leading-tight"
            />
          );
        })}
      </div>
    </nav>
  );
};

export const ExpenseBottomTabs = memo(ExpenseBottomTabsComponent);
ExpenseBottomTabs.displayName = "ExpenseBottomTabs";

function getTabKeyFromPath(pathname: string): ExpenseTabKey {
  if (pathname.startsWith("/expenses/approvals")) return "approvals";
  if (pathname.startsWith("/expenses/payment-process")) return "payment";
  if (pathname.startsWith("/expenses/reminder-bills")) return "bills";
  if (pathname.startsWith("/expenses/debt")) return "debt";
  if (pathname.startsWith("/expenses/dashboard")) return "dashboard";
  return "dashboard";
}

export function useExpenseTabs(initialTab: ExpenseTabKey = "dashboard") {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<ExpenseTabKey>(
    () => getTabKeyFromPath(location.pathname) ?? initialTab,
  );

  const setActiveTabOnLocationChange = useCallback(() => {
    setActiveTab(getTabKeyFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    setActiveTabOnLocationChange();
  }, [setActiveTabOnLocationChange]);

  const handleTabChange = useCallback(
    (tab: ExpenseTabKey) => {
      setActiveTab(tab);
      navigate(TABS[tab]);
    },
    [navigate],
  );

  return { activeTab, handleTabChange, setActiveTabOnLocationChange };
}

