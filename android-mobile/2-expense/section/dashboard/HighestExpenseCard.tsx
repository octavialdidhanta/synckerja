import { format } from "date-fns";
import { ArrowUpCircle } from "lucide-react";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ExpenseStatsItem } from "@/shared/hooks/finance/useExpenseDashboardStats";

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

interface HighestExpenseCardProps {
  highestExpense: ExpenseStatsItem | null;
}

export function HighestExpenseCard({ highestExpense }: HighestExpenseCardProps) {
  const { t } = useAppTranslation();
  const amount = highestExpense ? highestExpense.amount : 0;
  const name = highestExpense?.expense_name ?? t("expenses.noExpensesYet", "No expenses yet");
  const dateStr = highestExpense ? format(new Date(highestExpense.create_date), "dd MMM yyyy") : "—";
  return (
    <Card className="min-h-[7.25rem] w-full min-w-0 flex-shrink-0 border-0 bg-primary text-primary-foreground">
      <CardContent className="flex min-w-0 flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-lg bg-primary-foreground/20 p-2">
            <ArrowUpCircle className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="truncate text-sm font-medium text-primary-foreground/85">
            {t("expenses.highestExpense", "Highest Expense")}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-bold text-primary-foreground sm:text-3xl">
              {formatCurrency(amount)}
            </div>
            <div className="mt-1 truncate text-xs text-primary-foreground/85" title={name}>
              {name} · {dateStr}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
