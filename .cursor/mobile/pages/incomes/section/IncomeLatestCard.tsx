import { Card, CardContent } from "@/mobile/components/ui/card";
import { Clock3 } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { formatToRupiah } from "@/utils/formatCurrency";

interface IncomeLatestCardProps {
  latest: number;
  latestRecordedAt: string | null;
  latestTransactionName: string | null;
}

export function IncomeLatestCard({
  latest,
  latestRecordedAt,
  latestTransactionName,
}: IncomeLatestCardProps) {
  const { t, language } = useAppTranslation();
  const formattedDateTime = (() => {
    if (!latestRecordedAt) return "-";
    const parsed = new Date(latestRecordedAt);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  })();

  return (
    <Card className="bg-blue-600 text-white border-0 w-full min-w-0 flex-shrink-0 min-h-[7.25rem]">
      <CardContent className="p-3 min-w-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
            <Clock3 className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-blue-100 shrink-0">
            {t("incomes.latest", "Latest")}
          </span>
          <span className="text-xs text-blue-100 truncate">
            - {latestTransactionName || t("common.notAvailable", "Not Available")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-bold text-white truncate">{formatToRupiah(latest)}</div>
            <div className="text-xs text-blue-100 truncate mt-1">{formattedDateTime}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
