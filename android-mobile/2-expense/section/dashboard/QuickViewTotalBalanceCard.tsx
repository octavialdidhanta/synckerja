import { Link } from "react-router-dom";
import { DollarSign } from "lucide-react";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { Button } from "@/mobile-app/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useBankAccounts } from "@/shared/hooks/finance/useBankAccounts";
import { useBankAccountBalances } from "@/shared/hooks/finance/useBankAccountBalances";

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function QuickViewTotalBalanceCard() {
  const { t } = useAppTranslation();
  const { bankAccounts, loading: bankAccountsLoading } = useBankAccounts();
  const { balances: bankAccountBalances, loading: balancesLoading } = useBankAccountBalances();

  const totalBalance = bankAccountBalances.reduce((total, b) => total + (b.balance ?? 0), 0);

  return (
    <Card className="min-h-[7.25rem] w-full min-w-0 flex-shrink-0 border-0 bg-primary text-primary-foreground">
      <CardContent className="flex min-w-0 flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-lg bg-primary-foreground/20 p-2">
            <DollarSign className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="truncate text-sm font-medium text-primary-foreground/85">
            {t("expenses.quickViewTotalBalance", "Quick View Total Current Balance")}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-h-[1.75rem] items-center truncate text-2xl font-bold text-primary-foreground sm:text-3xl">
              {balancesLoading || bankAccountsLoading
                ? "—"
                : formatCurrency(totalBalance)}
            </div>
            <div className="mt-1 truncate text-xs text-primary-foreground/85">
              {bankAccounts.length}{" "}
              {t("expenses.bankAccountsRegistered", "bank accounts registered")}
            </div>
          </div>
          <Link to="/incomes/dashboard" className="flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="whitespace-nowrap border-0 bg-primary-foreground font-medium text-primary hover:bg-primary-foreground/90"
            >
              {t("expenses.viewIncome", "View Income")}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
