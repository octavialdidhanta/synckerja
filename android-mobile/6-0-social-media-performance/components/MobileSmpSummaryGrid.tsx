import { Skeleton } from "@/shared/components/ui/skeleton";
import { ProgressBar } from "@/shared/components/ProgressBar";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatSmpCount, formatSmpPercent } from "@/mobile/6-0-social-media-performance/shared/formatSmpMetrics";
import type {
  InsightTargetMetric,
  InsightTargetProgress,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import {
  PeriodCompareDeltaBadge,
  PeriodCompareFooter,
} from "@/6-0-digital-marketing-shared/components/PeriodCompareBits";
import type { KpiCompareDelta } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import { cn } from "@/shared/lib/utils";

export type MobileSmpSummaryCard = {
  key: string;
  label: string;
  value: string;
  metric?: InsightTargetMetric;
  audienceHint?: boolean;
  compareMetricKey?: string;
  compareDelta?: KpiCompareDelta | null;
  compareRangeLabel?: string;
  comparePreviousText?: string;
  compareLoading?: boolean;
  compareVisible?: boolean;
};

type MobileSmpSummaryGridProps = {
  cards: MobileSmpSummaryCard[];
  isLoading?: boolean;
  targetsLoading?: boolean;
  targetProgress?: InsightTargetProgress[];
};

function formatTargetRatio(
  metric: InsightTargetMetric,
  progress: InsightTargetProgress | undefined,
): string | null {
  if (!progress?.showProgress || progress.target == null || progress.target <= 0) return null;
  if (progress.actual == null) return null;
  if (metric === "avg_engagement_rate") {
    return `${formatSmpPercent(progress.actual)} / ${formatSmpPercent(progress.target)}`;
  }
  return `${formatSmpCount(progress.actual)} / ${formatSmpCount(progress.target)}`;
}

function targetProgressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.round((current / target) * 100));
}

export function MobileSmpSummaryGrid({
  cards,
  isLoading,
  targetsLoading,
  targetProgress = [],
}: MobileSmpSummaryGridProps) {
  const { t } = useAppTranslation();
  const progressByMetric = new Map(targetProgress.map((item) => [item.metric, item]));
  const showProgressSkeleton = Boolean(isLoading || targetsLoading);

  return (
    <div className="-mx-2 grid shrink-0 grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
      {cards.map((card) => {
        const progress = card.metric ? progressByMetric.get(card.metric) : undefined;
        const ratioText = card.metric ? formatTargetRatio(card.metric, progress) : null;
        const showBar =
          progress?.showProgress &&
          progress.target != null &&
          progress.target > 0 &&
          progress.actual != null;
        const progressPercent = showBar
          ? targetProgressPercent(progress.actual ?? 0, progress.target ?? 0)
          : null;
        const compareVisible = Boolean(card.compareVisible);

        return (
          <div key={card.key} className="bg-card px-4 py-3">
            <div className="mb-1 flex min-w-0 items-center gap-1">
              <p className="min-w-0 truncate text-[11px] text-muted-foreground">{card.label}</p>
              {compareVisible ? (
                <PeriodCompareDeltaBadge
                  compact
                  delta={card.compareDelta ?? null}
                  metricKey={card.compareMetricKey ?? card.key}
                  loading={Boolean(card.compareLoading || isLoading)}
                />
              ) : null}
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-lg font-semibold tabular-nums text-foreground">{card.value}</p>
            )}
            {compareVisible ? (
              <PeriodCompareFooter
                compact
                rangeLabel={card.compareRangeLabel ?? ""}
                previousText={card.comparePreviousText}
                loading={Boolean(card.compareLoading || isLoading)}
              />
            ) : null}

            {card.metric ? (
              <>
                <div className={cn("mt-2", !showBar && "min-h-[1.125rem]")}>
                  {showProgressSkeleton ? (
                    <Skeleton className="h-1.5 w-full" />
                  ) : showBar ? (
                    <ProgressBar
                      current={progress.actual ?? 0}
                      target={progress.target ?? 0}
                      color="primary"
                      showLabel={false}
                    />
                  ) : (
                    <div className="flex h-[1.125rem] items-center">
                      <span className="text-xs text-muted-foreground/50">—</span>
                    </div>
                  )}
                </div>
                {showBar && progressPercent != null ? (
                  <div className="mt-px flex items-baseline justify-between gap-1 leading-none">
                    <p className="min-w-0 truncate text-[10px] leading-none tabular-nums text-muted-foreground">
                      {ratioText}
                    </p>
                    <span className="shrink-0 text-[10px] font-medium leading-none tabular-nums text-primary">
                      {progressPercent}%
                    </span>
                  </div>
                ) : ratioText ? (
                  <p className="mt-px text-[10px] leading-none tabular-nums text-muted-foreground">{ratioText}</p>
                ) : null}
                {card.audienceHint && progress?.showProgress ? (
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    {t(
                      "digitalMarketing.socialMediaInsightReport.audienceSnapshotHint",
                      "Audience uses current follower/subscriber totals from the API.",
                    )}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
