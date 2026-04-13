import { memo, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wallet, CheckCircle2, CreditCard, ReceiptText } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

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
   * `mobile-app-bottom-nav`: di Android native `index.css` memaksa `padding-bottom: 0` pada nav + anak
   * (selaras `IncomeBottomTabs` / Home) agar tidak strip putih ganda di atas bilah navigasi sistem.
   * Di web/non-native, `safe-area-bottom-lower` pada grid tetap memberi inset bila perlu.
   */
  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
      <div
        className={cn(
          "mx-auto grid min-h-[52px] w-full max-w-md grid-cols-5",
          className ?? "safe-area-bottom-lower",
        )}
      >
        {tabItems.map(({ key, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={cn(
                "flex flex-col items-center px-1 py-2",
                expenseTabPressable,
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="mb-1 h-5 w-5" aria-hidden />
              <span className="text-center text-xs font-medium leading-tight">{labels[key]}</span>
            </button>
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

