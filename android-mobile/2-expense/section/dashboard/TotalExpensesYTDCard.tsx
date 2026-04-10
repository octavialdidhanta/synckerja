import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

interface TotalExpensesYTDCardProps {
  totalExpensesYTD: number;
  ytdTransactionCount: number;
}

export function TotalExpensesYTDCard({ totalExpensesYTD, ytdTransactionCount }: TotalExpensesYTDCardProps) {
  const { t } = useAppTranslation();
  return (
    <Card className="min-h-[7.25rem] w-full min-w-0 flex-shrink-0 border-0 bg-primary text-primary-foreground">
      <CardContent className="flex min-w-0 flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-lg bg-primary-foreground/20 p-2">
            <BarChart3 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="truncate text-sm font-medium text-primary-foreground/85">
            {t("expenses.totalExpensesYTD", "Total Expenses YTD")}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-bold text-primary-foreground sm:text-3xl">
              {formatCurrency(totalExpensesYTD)}
            </div>
            <div className="mt-1 truncate text-xs text-primary-foreground/85">
              {ytdTransactionCount} {t("expenses.transactions", "transactions")}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
