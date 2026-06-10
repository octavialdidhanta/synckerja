import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import type { YouTubeContentVideosResponse } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";

type YouTubeContentSummaryBarProps = {
  summary: YouTubeContentVideosResponse["summary"] | null | undefined;
  isLoading?: boolean;
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function formatPercent(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

export function YouTubeContentSummaryBar({ summary, isLoading = false }: YouTubeContentSummaryBarProps) {
  const { t } = useTranslation();

  const cards = [
    {
      label: t("digitalMarketing.youtubeContent.summaryVideos", "Videos"),
      value: formatCount(summary?.video_count ?? 0),
    },
    {
      label: t("digitalMarketing.youtubeContent.summaryViews", "Views"),
      value: formatCount(summary?.total_views ?? 0),
    },
    {
      label: t("digitalMarketing.youtubeContent.summaryLikes", "Likes"),
      value: formatCount(summary?.total_likes ?? 0),
    },
    {
      label: t("digitalMarketing.youtubeContent.summaryEngagement", "Avg. engagement"),
      value: formatPercent(summary?.avg_engagement_rate ?? null),
    },
  ];

  return (
    <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-1">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2"
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-20" />
            ) : (
              <p className="text-lg font-semibold tabular-nums text-gray-900">{card.value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
