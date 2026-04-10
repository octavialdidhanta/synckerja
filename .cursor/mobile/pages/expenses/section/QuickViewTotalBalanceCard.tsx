import { Card, CardContent } from "@/mobile/components/ui/card";
import { Button } from "@/mobile/components/ui/button";
import { Skeleton } from "@/mobile/components/ui/skeleton";
import { Link } from "react-router-dom";
import { DollarSign } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useBankAccounts } from "@/hooks/organized/useBankAccounts";
import { useBankAccountBalances } from "@/hooks/organized/useBankAccountBalances";

/**
 * Quick View Total Current Balance card.
 * Same logic as desktop ExpenseDashboard: sum of all bank account balances,
 * not affected by table filters; updates when expense uses bank balance.
 */
function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function QuickViewTotalBalanceCard() {
  const { t } = useAppTranslation();
  const { bankAccounts, loading: bankAccountsLoading } = useBankAccounts();
  const { balances: bankAccountBalances, loading: balancesLoading } =
    useBankAccountBalances();

  const totalBalance = bankAccountBalances.reduce(
    (total, b) => total + (b.balance ?? 0),
    0
  );

  return (
    <Card className="bg-blue-600 text-white border-0 w-full min-w-0 flex-shrink-0 min-h-[7.25rem]">
      <CardContent className="p-3 min-w-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
            <DollarSign className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-blue-100 truncate">
            {t("expenses.quickViewTotalBalance", "Quick View Total Current Balance")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-bold text-white truncate min-h-[1.75rem] flex items-center">
              {balancesLoading || bankAccountsLoading ? (
                <Skeleton className="h-7 w-28 bg-white/30" />
              ) : (
                formatCurrency(totalBalance)
              )}
            </div>
            <div className="text-xs text-blue-100 truncate mt-1">
              {bankAccounts.length} bank account{bankAccounts.length !== 1 ? "s" : ""}{" "}
              registered
            </div>
          </div>
          <Link to="/incomes/dashboard" className="flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="bg-white text-blue-600 hover:bg-blue-50 border-0 font-medium whitespace-nowrap"
            >
              {t("expenses.goToIncomeDashboard", "Lihat Income")}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
