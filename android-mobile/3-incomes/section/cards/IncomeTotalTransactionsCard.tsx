import { Card, CardContent } from "@/shared/components/ui/card";
import { Receipt } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  totalTransactions: number;
  currentMonthTransactionCount: number;
};

export function IncomeTotalTransactionsCard({ totalTransactions, currentMonthTransactionCount }: Props) {
  const { t } = useAppTranslation();
  return (
    <Card className="min-h-[7.25rem] w-full min-w-0 flex-shrink-0 border-0 bg-brand-blue text-white">
      <CardContent className="flex min-w-0 flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
            <Receipt className="h-4 w-4 text-white" />
          </div>
          <span className="truncate text-sm font-medium text-white/90">
            {t("incomes.totalTransactions", "Total Transactions")}
          </span>
        </div>
        <div className="min-w-0 flex flex-1 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-bold text-white sm:text-3xl">{totalTransactions}</div>
            <div className="mt-1 truncate text-xs text-white/80">
              {currentMonthTransactionCount} {t("incomes.thisMonth", "this month")}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
