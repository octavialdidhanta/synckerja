import { Skeleton } from "@/shared/components/ui/skeleton";
import { ProgressBar } from "@/shared/components/ProgressBar";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { InsightTargetMetric, InsightTargetProgress } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { SocialMediaInsightSummary } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

type Props = {
  summary: SocialMediaInsightSummary;
  targetProgress?: InsightTargetProgress[];
  isLoading?: boolean;
  targetsLoading?: boolean;
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function formatPercent(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function formatTargetRatio(
  metric: InsightTargetMetric,
  progress: InsightTargetProgress | undefined,
): string | null {
  if (!progress?.showProgress || progress.target == null || progress.target <= 0) return null;
  if (progress.actual == null) return null;

  if (metric === "avg_engagement_rate") {
    return `${formatPercent(progress.actual)} / ${formatPercent(progress.target)}`;
  }
  return `${formatCount(progress.actual)} / ${formatCount(progress.target)}`;
}

export function SocialMediaInsightReportSummaryBar({
  summary,
  targetProgress = [],
  isLoading = false,
  targetsLoading = false,
}: Props) {
  const { t } = useAppTranslation();

  const progressByMetric = new Map(targetProgress.map((p) => [p.metric, p]));

  const cards: {
    metric: InsightTargetMetric;
    label: string;
    value: string;
    audienceHint?: boolean;
  }[] = [
    {
      metric: "audience",
      label: t("digitalMarketing.socialMediaInsightReport.summaryAudience", "Audience"),
      value: summary.totalAudience != null ? formatCount(summary.totalAudience) : "—",
      audienceHint: true,
    },
    {
      metric: "views",
      label: t("digitalMarketing.socialMediaInsightReport.summaryViews", "Views"),
      value: formatCount(summary.totalViews),
    },
    {
      metric: "likes",
      label: t("digitalMarketing.socialMediaInsightReport.summaryLikes", "Likes"),
      value: formatCount(summary.totalLikes),
    },
    {
      metric: "comments",
      label: t("digitalMarketing.socialMediaInsightReport.summaryComments", "Comments"),
      value: formatCount(summary.totalComments),
    },
    {
      metric: "shares",
      label: t("digitalMarketing.socialMediaInsightReport.summaryShares", "Shares"),
      value: formatCount(summary.totalShares),
    },
    {
      metric: "avg_engagement_rate",
      label: t("digitalMarketing.socialMediaInsightReport.summaryEngagement", "Avg. engagement"),
      value: formatPercent(summary.avgEngagementRate),
    },
  ];

  const showProgressSkeleton = isLoading || targetsLoading;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const progress = progressByMetric.get(card.metric);
        const ratioText = formatTargetRatio(card.metric, progress);

        return (
          <div
            key={card.metric}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm"
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-20" />
            ) : (
              <p className="text-lg font-semibold tabular-nums text-gray-900">{card.value}</p>
            )}

            <div className="mt-2 min-h-[1.125rem]">
              {showProgressSkeleton ? (
                <Skeleton className="h-1.5 w-full" />
              ) : progress?.showProgress &&
                progress.target != null &&
                progress.target > 0 &&
                progress.actual != null ? (
                <ProgressBar
                  current={progress.actual}
                  target={progress.target}
                  color="primary"
                />
              ) : (
                <div className="flex h-[1.125rem] items-center">
                  <span className="text-xs text-gray-400">—</span>
                </div>
              )}
            </div>

            {ratioText ? (
              <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{ratioText}</p>
            ) : null}

            {card.audienceHint && progress?.showProgress ? (
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                {t(
                  "digitalMarketing.socialMediaInsightReport.audienceSnapshotHint",
                  "Audience uses current follower/subscriber totals from the API.",
                )}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
