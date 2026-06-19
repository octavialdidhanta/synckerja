import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { YouTubeChannelAnalyticsOverview } from "@/youtube-content/types/youtubeChannelAnalyticsTypes";

type Props = {
  overview: YouTubeChannelAnalyticsOverview | undefined;
  isLoading?: boolean;
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatWatchTimeHours(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0";
  const hours = minutes / 60;
  return hours >= 10 ? hours.toFixed(0) : hours.toFixed(1);
}

type CardConfig = {
  key: string;
  labelKey: string;
  fallback: string;
  value: string;
};

export function YouTubeChannelAnalyticsOverview({ overview, isLoading }: Props) {
  const { t } = useTranslation();

  const cards: CardConfig[] = overview
    ? [
        {
          key: "views",
          labelKey: "digitalMarketing.youtubeContent.analytics.overview.viewsInPeriod",
          fallback: "Views (in period)",
          value: formatCount(overview.views),
        },
        {
          key: "watchTime",
          labelKey: "digitalMarketing.youtubeContent.analytics.overview.watchTime",
          fallback: "Watch time (hrs)",
          value: formatWatchTimeHours(overview.estimated_minutes_watched),
        },
        {
          key: "avgDuration",
          labelKey: "digitalMarketing.youtubeContent.analytics.overview.avgDuration",
          fallback: "Avg. view duration",
          value: formatDuration(overview.average_view_duration_seconds),
        },
        {
          key: "subsGained",
          labelKey: "digitalMarketing.youtubeContent.analytics.overview.subsGained",
          fallback: "Subscribers gained",
          value: formatCount(overview.subscribers_gained),
        },
        {
          key: "subsLost",
          labelKey: "digitalMarketing.youtubeContent.analytics.overview.subsLost",
          fallback: "Subscribers lost",
          value: formatCount(overview.subscribers_lost),
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {(isLoading ? Array.from({ length: 5 }, (_, i) => `sk-${i}`) : cards.map((c) => c.key)).map(
        (key) => {
          const card = cards.find((c) => c.key === key);
          return (
            <div
              key={key}
              className="rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm"
            >
              {isLoading || !card ? (
                <>
                  <div className="mb-2 h-3 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{t(card.labelKey, card.fallback)}</p>
                  <p className={cn("mt-1 text-lg font-semibold tabular-nums text-gray-900")}>
                    {card.value}
                  </p>
                </>
              )}
            </div>
          );
        },
      )}
    </div>
  );
}
