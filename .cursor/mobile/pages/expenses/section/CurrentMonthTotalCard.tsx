import { Card, CardContent } from "@/mobile/components/ui/card";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { Calendar } from "lucide-react";

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

interface CurrentMonthTotalCardProps {
  currentMonthTotal: number;
}

export function CurrentMonthTotalCard({ currentMonthTotal }: CurrentMonthTotalCardProps) {
  const { t } = useAppTranslation();
  return (
    <Card className="bg-blue-600 text-white border-0 w-full min-w-0 flex-shrink-0 min-h-[7.25rem]">
      <CardContent className="p-3 min-w-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-blue-100 truncate">
            {t("expenses.currentMonthTotal", "Current Month Total")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-bold text-white truncate">
              {formatCurrency(currentMonthTotal)}
            </div>
            <div className="text-xs text-blue-100 truncate mt-1">
              vs. last month ↑ {currentMonthTotal > 0 ? "100" : "0"}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
