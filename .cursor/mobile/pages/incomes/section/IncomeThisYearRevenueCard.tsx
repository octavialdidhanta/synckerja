import { Card, CardContent } from "@/mobile/components/ui/card";
import { Calendar } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { formatToRupiah } from "@/utils/formatCurrency";

interface IncomeThisYearRevenueCardProps {
  thisYearRevenue: number;
}

export function IncomeThisYearRevenueCard({ thisYearRevenue }: IncomeThisYearRevenueCardProps) {
  const { t } = useAppTranslation();
  return (
    <Card className="bg-blue-600 text-white border-0 w-full min-w-0 flex-shrink-0 min-h-[7.25rem]">
      <CardContent className="p-3 min-w-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-blue-100 truncate">
            {t("incomes.thisYearRevenue", "This Year Revenue")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-bold text-white truncate">{formatToRupiah(thisYearRevenue)}</div>
            <div className="text-xs text-blue-100 truncate mt-1">
              {t("incomes.yearToDateIncome", "Year-to-date income")}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
