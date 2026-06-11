import { Skeleton } from "@/shared/components/ui/skeleton";
import { ProgressBar } from "@/shared/components/ProgressBar";
import { useTranslation } from "react-i18next";
import type { TikTokContentVideosResponse } from "@/tiktok-content/hooks/useTikTokContentVideosQuery";
import type {
  InsightTargetMetric,
  InsightTargetProgress,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

type TikTokContentSummaryBarProps = {
  summary: TikTokContentVideosResponse["summary"] | null | undefined;
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

export function TikTokContentSummaryBar({
  summary,
  targetProgress = [],
  isLoading = false,
  targetsLoading = false,
}: TikTokContentSummaryBarProps) {
  const { t } = useTranslation();
  const progressByMetric = new Map(targetProgress.map((item) => [item.metric, item]));
  const showProgressSkeleton = isLoading || targetsLoading;

  const cards: {
    key: string;
    label: string;
    value: string;
    metric?: InsightTargetMetric;
    audienceHint?: boolean;
  }[] = [
    {
      key: "audience",
      metric: "audience",
      label: t("digitalMarketing.tiktokContent.summaryFollowers", "Followers"),
      value:
        summary?.follower_count != null ? formatCount(summary.follower_count) : "—",
      audienceHint: true,
    },
    {
      key: "videos",
      label: t("digitalMarketing.tiktokContent.summaryVideos", "Videos"),
      value: formatCount(summary?.video_count ?? 0),
    },
    {
      key: "views",
      metric: "views",
      label: t("digitalMarketing.tiktokContent.summaryViews", "Views"),
      value: formatCount(summary?.total_views ?? 0),
    },
    {
      key: "likes",
      metric: "likes",
      label: t("digitalMarketing.tiktokContent.summaryLikes", "Likes"),
      value: formatCount(summary?.total_likes ?? 0),
    },
    {
      key: "engagement",
      metric: "avg_engagement_rate",
      label: t("digitalMarketing.tiktokContent.summaryEngagement", "Avg. engagement"),
      value: formatPercent(summary?.avg_engagement_rate ?? null),
    },
  ];

  return (
    <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-1">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const progress = card.metric ? progressByMetric.get(card.metric) : undefined;
          const ratioText = card.metric ? formatTargetRatio(card.metric, progress) : null;

          return (
            <div
              key={card.key}
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
    </div>
  );
}
