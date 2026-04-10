import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { AlertTriangle } from "lucide-react";

interface BillsOverdueCarouselCardProps {
  count: number;
  amount: number;
}

export function BillsOverdueCarouselCard({ count, amount }: BillsOverdueCarouselCardProps) {
  const { t } = useAppTranslation();

  return (
    <Card className="min-h-[7.25rem] w-full min-w-0 flex-shrink-0 border-0 bg-brand-blue text-white">
      <CardContent className="flex min-w-0 flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <span className="truncate text-sm font-medium text-white/90">
            {t("reminderBills.metrics.overdue", "Overdue")}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-bold text-white sm:text-3xl">{count}</div>
            <div className="mt-1 truncate text-xs text-white/80">{formatToRupiah(amount)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
