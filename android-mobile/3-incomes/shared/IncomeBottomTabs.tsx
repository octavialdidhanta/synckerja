import { BarChart3, CircleDollarSign, Landmark, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MOBILE_INCOMES_BANK_ACCOUNT_PATH,
  MOBILE_INCOMES_DASHBOARD_PATH,
  MOBILE_INCOMES_PIUTANG_PATH,
  MOBILE_INCOMES_TRANSACTION_PATH,
} from "@/mobile/3-dashboard/shared/mobileIncomesNavPaths";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

type IncomeBottomTabsProps = {
  className?: string;
};

export function IncomeBottomTabs({ className }: IncomeBottomTabsProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  const isDashboard = pathname.startsWith(MOBILE_INCOMES_DASHBOARD_PATH);
  const isBankAccRoute =
    pathname === MOBILE_INCOMES_BANK_ACCOUNT_PATH ||
    pathname.startsWith(`${MOBILE_INCOMES_BANK_ACCOUNT_PATH}/`);
  const isLegacyBankAcc = pathname === "/incomes/bank-accounts";
  const isBankAcc = isBankAccRoute || isLegacyBankAcc;
  const isPiutang =
    pathname === MOBILE_INCOMES_PIUTANG_PATH || pathname.startsWith(`${MOBILE_INCOMES_PIUTANG_PATH}/`);
  const isTransaction =
    (pathname === MOBILE_INCOMES_TRANSACTION_PATH ||
      pathname.startsWith(`${MOBILE_INCOMES_TRANSACTION_PATH}/`)) &&
    !isPiutang;

  const tabs = [
    {
      pagePath: MOBILE_PAGE_PATH.incomesDashboard,
      label: t("incomes.dashboardSubtitle", "Dashboard"),
      icon: BarChart3,
      isActive: isDashboard,
      onActivate: () => navigate(MOBILE_INCOMES_DASHBOARD_PATH),
    },
    {
      pagePath: MOBILE_PAGE_PATH.incomesTransaction,
      label: t("incomes.transactionTitle", "Income"),
      icon: Wallet,
      isActive: isTransaction && !isBankAcc,
      onActivate: () => navigate(MOBILE_INCOMES_TRANSACTION_PATH),
    },
    {
      pagePath: MOBILE_PAGE_PATH.incomesPiutang,
      label: t("incomes.piutangTitle", "Piutang"),
      icon: CircleDollarSign,
      isActive: isPiutang,
      onActivate: () => navigate(MOBILE_INCOMES_PIUTANG_PATH),
    },
    {
      pagePath: MOBILE_PAGE_PATH.incomesTransaction,
      label: t("incomes.bankAccTitle", "Bank Acc"),
      icon: Landmark,
      isActive: isBankAcc,
      onActivate: () => navigate(MOBILE_INCOMES_BANK_ACCOUNT_PATH),
    },
  ] as const;

  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card safe-area-bottom-lower">
      <div className={cn("mx-auto grid min-h-[52px] w-full max-w-md grid-cols-4", className)}>
        {tabs.map((tab) => (
          <MobileNavTabButton
            key={tab.label}
            pagePath={tab.pagePath}
            label={tab.label}
            icon={tab.icon}
            isActive={tab.isActive}
            onActivate={tab.onActivate}
            labelClassName="text-xs font-medium"
          />
        ))}
      </div>
    </nav>
  );
}
