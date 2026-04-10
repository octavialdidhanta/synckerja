import React, { memo, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wallet, CheckCircle2, CreditCard, ReceiptText } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { cn } from "@/lib/utils";

export type ExpenseTabKey = "dashboard" | "debt" | "approvals" | "payment" | "bills";

const TABS: Record<ExpenseTabKey, string> = {
  dashboard: "/expenses/dashboard",
  debt: "/expenses/debt",
  approvals: "/expenses/approvals",
  payment: "/expenses/payment-process",
  bills: "/expenses/reminder-bills",
};

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

const ExpenseBottomTabsComponent: React.FC<ExpenseBottomTabsProps> = ({
  activeTab,
  onTabChange,
  className,
}) => {
  const { t } = useAppTranslation();
  const labels: Record<ExpenseTabKey, string> = {
    dashboard: t("expenses.tabs.dashboard", "Dashboard"),
    debt: t("expenses.tabs.debt", "Debt"),
    approvals: t("expenses.tabs.approvals", "Approvals"),
    payment: t("expenses.tabs.payment", "Payment"),
    bills: t("expenses.tabs.bills", "Bills"),
  };

  return (
    <nav className="fixed left-0 right-0 bottom-0 bg-card border-t border-border z-30">
      <div
        className={cn(
          "grid grid-cols-5 w-full",
          className ?? "safe-area-padding-bottom"
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
                "flex flex-col items-center py-2 px-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{labels[key]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export const ExpenseBottomTabs = memo(ExpenseBottomTabsComponent);
ExpenseBottomTabs.displayName = "ExpenseBottomTabs";

const getTabKeyFromPath = (pathname: string): ExpenseTabKey => {
  if (pathname.startsWith("/expenses/approvals")) return "approvals";
  if (pathname.startsWith("/expenses/payment-process")) return "payment";
  if (pathname.startsWith("/expenses/reminder-bills")) return "bills";
  if (pathname.startsWith("/expenses/debt")) return "debt";
  if (pathname.startsWith("/expenses/dashboard")) return "dashboard";
  return "dashboard";
};

export const useExpenseTabs = (initialTab: ExpenseTabKey = "dashboard") => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<ExpenseTabKey>(
    () => getTabKeyFromPath(location.pathname) ?? initialTab
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
    [navigate]
  );

  return { activeTab, handleTabChange, setActiveTabOnLocationChange };
};
