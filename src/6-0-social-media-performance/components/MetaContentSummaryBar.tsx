import { Skeleton } from '@/shared/components/ui/skeleton';
import { ProgressBar } from '@/shared/components/ProgressBar';
import { useTranslation } from 'react-i18next';
import type { MetaContentMetricsPayload, MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';
import { aggregateMetaContentPostRows } from '@/meta-content/lib/aggregateMetaContentPostRows';
import type {
  InsightTargetMetric,
  InsightTargetProgress,
} from '@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes';
import {
  PeriodCompareDeltaBadge,
  PeriodCompareFooter,
} from '@/6-0-digital-marketing-shared/components/PeriodCompareBits';
import {
  buildMetaContentCompareSnapshot,
  metaContentPeriodCompareBits,
  useMetaContentSummaryPeriodCompare,
  type MetaContentCompareCardKey,
} from '@/6-0-social-media-performance/hooks/useMetaContentSummaryPeriodCompare';

type MetaContentSummaryBarProps = {
  account?: MetaContentMetricsPayload['account'] | null;
  posts?: MetaContentMetricsPayload['posts'];
  targetProgress?: InsightTargetProgress[];
  isLoading?: boolean;
  targetsLoading?: boolean;
  organizationId?: string | null;
  platform?: MetaContentPlatform;
  accountId?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  compareEnabled?: boolean;
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

function formatAudienceCount(
  account: MetaContentMetricsPayload['account'] | null | undefined,
): string {
  if (account?.audience_hidden) return '—';
  const count = account?.audience_count;
  if (count == null || !Number.isFinite(count)) return '—';
  return formatCount(count);
}

function isCompareCardKey(key: string): key is MetaContentCompareCardKey {
  return (
    key === 'reach' ||
    key === 'views' ||
    key === 'engagement' ||
    key === 'posts' ||
    key === 'avgEngagement'
  );
}

export function MetaContentSummaryBar({
  account,
  posts = [],
  targetProgress = [],
  isLoading = false,
  targetsLoading = false,
  organizationId = null,
  platform = 'facebook',
  accountId = null,
  dateStart = null,
  dateEnd = null,
  compareEnabled = false,
}: MetaContentSummaryBarProps) {
  const { t } = useTranslation();
  const progressByMetric = new Map(targetProgress.map((item) => [item.metric, item]));
  const showProgressSkeleton = isLoading || targetsLoading;

  const { previousRange, previousSnapshot, compareLoading, compareError } =
    useMetaContentSummaryPeriodCompare({
      organizationId,
      platform,
      accountId,
      dateStart,
      dateEnd,
      enabled: compareEnabled,
    });
  const currentSnapshot = buildMetaContentCompareSnapshot({ account, posts });

  const totals = aggregateMetaContentPostRows(posts);

  const reach = totals.reach;
  // Instagram Professional Dashboard "Views" = avg of last 3 posts (from edge).
  const useIgAvgLast3 =
    account?.platform === 'instagram' &&
    (account.views_mode === 'avg_last_3' || account.avg_views_last_3 != null);
  const views = useIgAvgLast3
    ? Number(account?.avg_views_last_3 ?? account?.total_views ?? totals.views) || 0
    : totals.views;
  const engagement = totals.engagement;
  const postCount = totals.postCount;
  const avgEngagementRate =
    account?.avg_engagement_rate ??
    (engagement > 0 && totals.views > 0 ? (engagement / totals.views) * 100 : null);

  const cards: {
    key: string;
    label: string;
    value: string;
    metric?: InsightTargetMetric;
    audienceHint?: boolean;
    viewsHint?: boolean;
  }[] = [
    {
      key: 'audience',
      metric: 'audience',
      label: t('digitalMarketing.metaContent.summaryFollowers', 'Followers'),
      value: formatAudienceCount(account),
      audienceHint: true,
    },
    {
      key: 'reach',
      label: t('metaPlatform.metrics.reach', 'Reach'),
      value: formatCount(reach),
    },
    {
      key: 'views',
      metric: 'views',
      label: useIgAvgLast3
        ? t('digitalMarketing.metaContent.summaryViewsAvgLast3', 'Views (avg last 3)')
        : t('digitalMarketing.metaContent.summaryViews', 'Views'),
      value: formatCount(views),
      viewsHint: useIgAvgLast3,
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => {
          const progress = card.metric ? progressByMetric.get(card.metric) : undefined;
          const ratioText = card.metric ? formatTargetRatio(card.metric, progress) : null;
          const slotCompare = isCompareCardKey(card.key)
            ? metaContentPeriodCompareBits({
                cardKey: card.key,
                currentSnapshot,
                previousSnapshot,
                previousRange,
                compareLoading: compareLoading || isLoading,
                compareError,
              })
            : null;
          const compareVisible = Boolean(slotCompare?.compareVisible);

          return (
            <div
              key={card.key}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm"
            >
              <div className="flex min-w-0 items-center gap-1">
                <p className="min-w-0 truncate text-xs text-muted-foreground">{card.label}</p>
                {compareVisible && slotCompare ? (
                  <PeriodCompareDeltaBadge
                    delta={slotCompare.compareDelta}
                    metricKey={slotCompare.compareMetricKey}
                    loading={slotCompare.compareLoading}
                  />
                ) : null}
              </div>
              {isLoading ? (
                <Skeleton className="mt-1 h-6 w-20" />
              ) : (
                <p className="text-lg font-semibold tabular-nums text-gray-900">{card.value}</p>
              )}
              {compareVisible && slotCompare ? (
                <PeriodCompareFooter
                  rangeLabel={slotCompare.compareRangeLabel}
                  previousText={slotCompare.comparePreviousText}
                  loading={slotCompare.compareLoading}
                />
              ) : null}

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
                    'digitalMarketing.socialMediaInsightReport.audienceSnapshotHint',
                    'Audience uses current follower/subscriber totals from the API.',
                  )}
                </p>
              ) : null}

              {card.viewsHint ? (
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  {t(
                    'digitalMarketing.metaContent.summaryViewsAvgLast3Hint',
                    'Matches Instagram: average views of your last 3 posts.',
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
