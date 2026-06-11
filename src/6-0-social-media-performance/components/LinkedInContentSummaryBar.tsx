import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import type { LinkedInContentPostsResponse } from "@/linkedin-content/hooks/useLinkedInContentPostsQuery";

type LinkedInContentSummaryBarProps = {
  summary: LinkedInContentPostsResponse["summary"] | null | undefined;
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

export function LinkedInContentSummaryBar({ summary, isLoading = false }: LinkedInContentSummaryBarProps) {
  const { t } = useTranslation();

  const cards = [
    {
      label: t("digitalMarketing.linkedinContent.summaryPosts", "Posts"),
      value: formatCount(summary?.post_count ?? 0),
    },
    {
      label: t("digitalMarketing.linkedinContent.summaryViews", "Views"),
      value: formatCount(summary?.total_views ?? 0),
    },
    {
      label: t("digitalMarketing.linkedinContent.summaryLikes", "Likes"),
      value: formatCount(summary?.total_likes ?? 0),
    },
    {
      label: t("digitalMarketing.linkedinContent.summaryEngagement", "Avg. engagement"),
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
