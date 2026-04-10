import { format } from "date-fns";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { Clock } from "lucide-react";
import type { ExpenseStatsItem } from "@/mobile/pages/expenses/hooks/useExpenseDashboardStats";

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

interface LatestTransactionCardProps {
  latestExpense: ExpenseStatsItem | null;
}

export function LatestTransactionCard({ latestExpense }: LatestTransactionCardProps) {
  const { t } = useAppTranslation();
  const amount = latestExpense ? latestExpense.amount : 0;
  const name = latestExpense?.expense_name ?? t("expenses.noExpensesYet", "No expenses yet");
  const dateStr = latestExpense
    ? format(new Date(latestExpense.create_date), "dd MMM yyyy")
    : "—";
  return (
    <Card className="bg-blue-600 text-white border-0 w-full min-w-0 flex-shrink-0 min-h-[7.25rem]">
      <CardContent className="p-3 min-w-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
            <Clock className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-blue-100 truncate">
            {t("expenses.latestTransaction", "Latest Transaction")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-bold text-white truncate">
              {formatCurrency(amount)}
            </div>
            <div className="text-xs text-blue-100 truncate mt-1" title={name}>
              {name} · {dateStr}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
