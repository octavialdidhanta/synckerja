import { Card, CardContent } from "@/shared/components/ui/card";
import { TrendingUp } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export function IncomeGrowthCard({ growthPercentage }: { growthPercentage: number }) {
  const { t } = useAppTranslation();
  const positive = growthPercentage >= 0;
  return (
    <Card className="min-h-[7.25rem] w-full min-w-0 flex-shrink-0 border-0 bg-brand-blue text-white">
      <CardContent className="flex min-w-0 flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="truncate text-sm font-medium text-white/90">{t("incomes.growth", "Growth")}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-2xl font-bold sm:text-3xl",
              positive ? "text-white" : "text-amber-100",
            )}
          >
            {positive ? "+" : ""}
            {growthPercentage.toFixed(1)}%
          </div>
          <div className="mt-1 truncate text-xs text-white/80">{t("incomes.vsLastMonth", "vs last month")}</div>
        </div>
      </CardContent>
    </Card>
  );
}
