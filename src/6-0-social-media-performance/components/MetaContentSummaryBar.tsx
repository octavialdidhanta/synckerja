import { Skeleton } from '@/shared/components/ui/skeleton';
import { ProgressBar } from '@/shared/components/ProgressBar';
import { useTranslation } from 'react-i18next';
import type { MetaContentMetricsPayload } from '@/meta-platform/types/metaContentTypes';
import { aggregateMetaContentPostRows } from '@/meta-content/lib/aggregateMetaContentPostRows';
import type {
  InsightTargetMetric,
  InsightTargetProgress,
} from '@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes';

type MetaContentSummaryBarProps = {
  posts?: MetaContentMetricsPayload['posts'];
  targetProgress?: InsightTargetProgress[];
  isLoading?: boolean;
  targetsLoading?: boolean;
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function formatPercent(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}%`;
}

function formatTargetRatio(
  metric: InsightTargetMetric,
  progress: InsightTargetProgress | undefined,
): string | null {
  if (!progress?.showProgress || progress.target == null || progress.target <= 0) return null;
  if (progress.actual == null) return null;

  if (metric === 'avg_engagement_rate') {
    return `${formatPercent(progress.actual)} / ${formatPercent(progress.target)}`;
  }
  return `${formatCount(progress.actual)} / ${formatCount(progress.target)}`;
}

export function MetaContentSummaryBar({
  posts = [],
  targetProgress = [],
  isLoading = false,
  targetsLoading = false,
}: MetaContentSummaryBarProps) {
  const { t } = useTranslation();
  const progressByMetric = new Map(targetProgress.map((item) => [item.metric, item]));
  const showProgressSkeleton = isLoading || targetsLoading;

  const totals = aggregateMetaContentPostRows(posts);

  const reach = totals.reach;
  const views = totals.views;
  const engagement = totals.engagement;
  const postCount = totals.postCount;
  const avgEngagementRate =
    engagement > 0 && views > 0 ? (engagement / views) * 100 : null;

  const cards: {
    key: string;
    label: string;
    value: string;
    metric?: InsightTargetMetric;
  }[] = [
    {
      key: 'reach',
      label: t('metaPlatform.metrics.reach', 'Reach'),
      value: formatCount(reach),
    },
    {
      key: 'views',
      metric: 'views',
      label: t('digitalMarketing.metaContent.summaryViews', 'Views'),
      value: formatCount(views),
    },
    {
      key: 'engagement',
      label: t('metaPlatform.metrics.engagement', 'Engagement'),
      value: formatCount(engagement),
    },
    {
      key: 'posts',
      label: t('metaPlatform.metrics.posts', 'Posts'),
      value: formatCount(postCount),
    },
    {
      key: 'avgEngagement',
      metric: 'avg_engagement_rate',
      label: t('digitalMarketing.metaContent.summaryAvgEngagement', 'Avg. engagement'),
      value: formatPercent(avgEngagementRate),
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
