import { Skeleton } from '@/shared/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import type { ThreadsContentMetricsPayload } from '@/threads-content/hooks/useThreadsContentMetrics';

type ThreadsContentSummaryBarProps = {
  account: ThreadsContentMetricsPayload['account'] | null | undefined;
  isLoading?: boolean;
};

function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function formatPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}%`;
}

export function ThreadsContentSummaryBar({ account, isLoading = false }: ThreadsContentSummaryBarProps) {
  const { t } = useTranslation();

  const cards = [
    {
      label: t('digitalMarketing.threadsContent.summaryFollowers', 'Followers'),
      value: formatCount(account?.audience_count),
    },
    {
      label: t('digitalMarketing.threadsContent.summaryPosts', 'Posts'),
      value: formatCount(account?.content_count),
    },
    {
      label: t('digitalMarketing.threadsContent.summaryViews', 'Views'),
      value: formatCount(account?.total_views),
    },
    {
      label: t('digitalMarketing.threadsContent.summaryEngagement', 'Avg. engagement'),
      value: formatPercent(account?.avg_engagement_rate),
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
