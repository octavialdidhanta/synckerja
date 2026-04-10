import { BarChart3, Landmark, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

export function IncomeBottomTabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  const isDashboard = pathname.startsWith("/incomes/dashboard");
  const isBankAcc = pathname.startsWith("/incomes/transaction/bank-account");
  const isTransaction = pathname.startsWith("/incomes/transaction") && !isBankAcc;

  return (
    <nav className="fixed left-0 right-0 bottom-0 bg-card border-t border-border z-30">
      <div className="grid grid-cols-3 max-w-md mx-auto safe-area-bottom-lower">
        <button
          type="button"
          onClick={() => navigate("/incomes/dashboard")}
          className={`flex flex-col items-center py-2 px-1 transition-colors ${
            isDashboard ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">
            {t("incomes.dashboardSubtitle", "Dashboard")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate("/incomes/transaction")}
          className={`flex flex-col items-center py-2 px-1 transition-colors ${
            isTransaction ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wallet className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">
            {t("incomes.transactionTitle", "Income")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate("/incomes/transaction/bank-account")}
          className={`flex flex-col items-center py-2 px-1 transition-colors ${
            isBankAcc ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Landmark className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">
            {t("incomes.bankAccTitle", "Bank Acc")}
          </span>
        </button>
      </div>
    </nav>
  );
}
