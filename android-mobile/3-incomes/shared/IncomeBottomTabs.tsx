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

  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
      <div className={cn("mx-auto grid min-h-[52px] w-full max-w-md grid-cols-4", className)}>
        <button
          type="button"
          onClick={() => navigate(MOBILE_INCOMES_DASHBOARD_PATH)}
          className={cn(
            "flex flex-col items-center px-1 py-2 transition-colors",
            isDashboard ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <BarChart3 className="mb-1 h-5 w-5" />
          <span className="text-xs font-medium">{t("incomes.dashboardSubtitle", "Dashboard")}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(MOBILE_INCOMES_TRANSACTION_PATH)}
          className={cn(
            "flex flex-col items-center px-1 py-2 transition-colors",
            isTransaction && !isBankAcc ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Wallet className="mb-1 h-5 w-5" />
          <span className="text-xs font-medium">{t("incomes.transactionTitle", "Income")}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(MOBILE_INCOMES_PIUTANG_PATH)}
          className={cn(
            "flex flex-col items-center px-1 py-2 transition-colors",
            isPiutang ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <CircleDollarSign className="mb-1 h-5 w-5" />
          <span className="text-xs font-medium">{t("incomes.piutangTitle", "Piutang")}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(MOBILE_INCOMES_BANK_ACCOUNT_PATH)}
          className={cn(
            "flex flex-col items-center px-1 py-2 transition-colors",
            isBankAcc ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Landmark className="mb-1 h-5 w-5" />
          <span className="text-xs font-medium">{t("incomes.bankAccTitle", "Bank Acc")}</span>
        </button>
      </div>
    </nav>
  );
}
