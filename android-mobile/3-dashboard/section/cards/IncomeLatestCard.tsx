import { Card, CardContent } from "@/shared/components/ui/card";
import { Clock3 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";

type Props = {
  latest: number;
  latestRecordedAt: string | null;
  latestTransactionName: string | null;
};

export function IncomeLatestCard({ latest, latestRecordedAt, latestTransactionName }: Props) {
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
    <Card className="min-h-[7.25rem] w-full min-w-0 flex-shrink-0 border-0 bg-brand-blue text-white">
      <CardContent className="flex min-w-0 flex-col gap-3 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
            <Clock3 className="h-4 w-4 text-white" />
          </div>
          <span className="shrink-0 text-sm font-medium text-white/90">{t("incomes.latest", "Latest")}</span>
          <span className="truncate text-xs text-white/80">
            — {latestTransactionName || t("common.notAvailable", "Not Available")}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xl font-bold text-white sm:text-3xl">{formatToRupiah(latest)}</div>
          <div className="mt-1 truncate text-xs text-white/80">{formattedDateTime}</div>
        </div>
      </CardContent>
    </Card>
  );
}
