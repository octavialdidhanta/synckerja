import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ThreadsContentPostRow } from '@/threads-content/hooks/useThreadsContentMetrics';
import { cn } from '@/shared/lib/utils';

type ThreadsContentPostsTableProps = {
  rows: ThreadsContentPostRow[];
};

type MetricSortKey = 'views' | 'likes' | 'comments' | 'shares' | 'engagement';

type SortDir = 'asc' | 'desc';

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function formatPercent(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}%`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

function compareMetricRows(
  a: ThreadsContentPostRow,
  b: ThreadsContentPostRow,
  key: MetricSortKey,
  dir: SortDir,
): number {
  let cmp = 0;

  switch (key) {
    case 'views':
      cmp = a.view_count - b.view_count;
      break;
    case 'likes':
      cmp = a.like_count - b.like_count;
      break;
    case 'comments':
      cmp = a.comment_count - b.comment_count;
      break;
    case 'shares':
      cmp = a.share_count - b.share_count;
      break;
    case 'engagement': {
      const av = a.engagement_rate;
      const bv = b.engagement_rate;
      const aMissing = av == null || !Number.isFinite(av);
      const bMissing = bv == null || !Number.isFinite(bv);
      if (aMissing && bMissing) cmp = 0;
      else if (aMissing) cmp = 1;
      else if (bMissing) cmp = -1;
      else cmp = av - bv;
      break;
    }
  }

  return dir === 'asc' ? cmp : -cmp;
}

function SortableMetricHeader({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: MetricSortKey;
  activeSortKey: MetricSortKey | null;
  sortDir: SortDir;
  onSort: (key: MetricSortKey) => void;
}) {
  const active = activeSortKey === sortKey;
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <th className="px-4 py-2 text-right font-medium" aria-sort={ariaSort}>
      <button
        type="button"
        className="ml-auto inline-flex max-w-full items-center gap-0.5 rounded px-0.5 py-0.5 hover:bg-gray-100"
        onClick={() => onSort(sortKey)}
        aria-label={`${label}, sort ${active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}`}
      >
        <span className="truncate">{label}</span>
        <span className="flex shrink-0 flex-col leading-none" aria-hidden>
          <ArrowUp
            className={cn(
              'h-3 w-3',
              active && sortDir === 'asc' ? 'text-brand-blue' : 'text-gray-300',
            )}
          />
          <ArrowDown
            className={cn(
              '-mt-1 h-3 w-3',
              active && sortDir === 'desc' ? 'text-brand-blue' : 'text-gray-300',
            )}
          />
        </span>
      </button>
    </th>
  );
}

export function ThreadsContentPostsTable({ rows }: ThreadsContentPostsTableProps) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<MetricSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: MetricSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('desc');
      return key;
    });
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => compareMetricRows(a, b, sortKey, sortDir));
  }, [rows, sortKey, sortDir]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {t('digitalMarketing.threadsContent.noPosts', 'No Threads posts in this date range.')}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[1180px] table-fixed text-sm">
        <colgroup>
          <col className="w-[168px]" />
          <col className="w-[160px]" />
          <col className="w-[96px]" />
          <col className="w-[96px]" />
          <col className="w-[96px]" />
          <col className="w-[72px]" />
          <col className="w-[64px]" />
          <col className="w-[80px]" />
          <col className="w-[64px]" />
          <col className="w-[88px]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-gray-100 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t('digitalMarketing.threadsContent.colPost', 'Post')}</th>
            <th className="px-4 py-2 font-medium">{t('digitalMarketing.threadsContent.colLink', 'Link')}</th>
            <th className="px-4 py-2 font-medium">{t('digitalMarketing.threadsContent.colService', 'Service')}</th>
            <th className="px-4 py-2 font-medium">{t('digitalMarketing.threadsContent.colPillar', 'Pillar')}</th>
            <th className="px-4 py-2 font-medium">{t('digitalMarketing.threadsContent.colDate', 'Date')}</th>
            <SortableMetricHeader
              label={t('digitalMarketing.threadsContent.colViews', 'Views')}
              sortKey="views"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('digitalMarketing.threadsContent.colLikes', 'Likes')}
              sortKey="likes"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('digitalMarketing.threadsContent.colComments', 'Comments')}
              sortKey="comments"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('digitalMarketing.threadsContent.colShares', 'Shares')}
              sortKey="shares"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('digitalMarketing.threadsContent.colEngagement', 'Engagement')}
              sortKey="engagement"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.content_id} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="max-w-[168px] overflow-hidden px-4 py-2">
                <p
                  className="truncate font-medium text-gray-900"
                  title={row.caption?.trim() || row.content_id}
                >
                  {row.caption?.trim() || row.content_id}
                </p>
              </td>
              <td className="max-w-[160px] overflow-hidden px-4 py-2">
                {row.permalink ? (
                  <a
                    href={row.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-primary hover:underline"
                    title={row.permalink}
                  >
                    {row.permalink}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td
                className="max-w-[96px] truncate px-4 py-2 text-muted-foreground"
                title={row.service_name ?? undefined}
              >
                {row.service_name ?? '—'}
              </td>
              <td
                className="max-w-[96px] truncate px-4 py-2 text-muted-foreground"
                title={row.content_pillar ?? undefined}
              >
                {row.content_pillar ?? '—'}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{formatDate(row.posted_at)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCount(row.view_count)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCount(row.like_count)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCount(row.comment_count)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCount(row.share_count)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatPercent(row.engagement_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
