import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MetaContentMetricsPayload } from '@/meta-platform/types/metaContentTypes';
import { cn } from '@/shared/lib/utils';

type MetaContentPostRow = MetaContentMetricsPayload['posts'][number];

type MetaContentPostsTableProps = {
  rows: MetaContentPostRow[];
};

type MetricSortKey = 'views' | 'likes' | 'comments' | 'reach' | 'shares' | 'engagement';

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

function compareRows(
  a: MetaContentPostRow,
  b: MetaContentPostRow,
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
    case 'reach':
      cmp = a.reach - b.reach;
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
    <th className="px-3 py-2 text-right font-medium" aria-sort={ariaSort}>
      <button
        type="button"
        className="ml-auto inline-flex max-w-full items-center gap-0.5 rounded px-0.5 py-0.5 hover:bg-gray-100"
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{label}</span>
        <span className="flex shrink-0 flex-col leading-none" aria-hidden>
          <ArrowUp
            className={cn('h-3 w-3', active && sortDir === 'asc' ? 'text-brand-blue' : 'text-gray-300')}
          />
          <ArrowDown
            className={cn('-mt-1 h-3 w-3', active && sortDir === 'desc' ? 'text-brand-blue' : 'text-gray-300')}
          />
        </span>
      </button>
    </th>
  );
}

export function MetaContentPostsTable({ rows }: MetaContentPostsTableProps) {
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
    return [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [rows, sortKey, sortDir]);

  if (rows.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
        {t('digitalMarketing.metaContent.noPosts', 'No posts found.')}
      </p>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto">
      <table className="w-full min-w-[1280px] table-fixed text-sm">
        <colgroup>
          <col className="w-[168px]" />
          <col className="w-[160px]" />
          <col className="w-[96px]" />
          <col className="w-[96px]" />
          <col className="w-[88px]" />
          <col className="w-[72px]" />
          <col className="w-[64px]" />
          <col className="w-[80px]" />
          <col className="w-[72px]" />
          <col className="w-[64px]" />
          <col className="w-[88px]" />
        </colgroup>
        <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-[0_1px_0_0_rgb(229,231,235)]">
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">
              {t('metaPlatform.performance.caption', 'Caption')}
            </th>
            <th className="px-3 py-2 font-medium">
              {t('digitalMarketing.metaContent.colLink', 'Link')}
            </th>
            <th className="px-3 py-2 font-medium">
              {t('digitalMarketing.metaContent.colService', 'Service')}
            </th>
            <th className="px-3 py-2 font-medium">
              {t('digitalMarketing.metaContent.colPillar', 'Pillar')}
            </th>
            <th className="px-3 py-2 font-medium">
              {t('digitalMarketing.metaContent.colPosted', 'Posted')}
            </th>
            <SortableMetricHeader
              label={t('metaPlatform.performance.views', 'Views')}
              sortKey="views"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('metaPlatform.performance.likes', 'Likes')}
              sortKey="likes"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('metaPlatform.performance.comments', 'Comments')}
              sortKey="comments"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('metaPlatform.performance.reach', 'Reach')}
              sortKey="reach"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('digitalMarketing.metaContent.colShares', 'Shares')}
              sortKey="shares"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('digitalMarketing.metaContent.colEngagement', 'Engagement')}
              sortKey="engagement"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const caption = row.caption?.trim() || row.content_id;
            return (
              <tr key={row.content_id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="max-w-[168px] overflow-hidden px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {row.media_url ? (
                      <img
                        src={row.media_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    ) : null}
                    <p className="truncate font-medium text-gray-900" title={caption}>
                      {caption}
                    </p>
                  </div>
                </td>
                <td className="max-w-[160px] overflow-hidden px-3 py-2">
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
                  className="max-w-[96px] truncate px-3 py-2 text-muted-foreground"
                  title={row.service_name ?? undefined}
                >
                  {row.service_name ?? '—'}
                </td>
                <td
                  className="max-w-[96px] truncate px-3 py-2 text-muted-foreground"
                  title={row.content_pillar ?? undefined}
                >
                  {row.content_pillar ?? '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(row.posted_at)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.view_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.like_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.comment_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.reach)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.share_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatPercent(row.engagement_rate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
