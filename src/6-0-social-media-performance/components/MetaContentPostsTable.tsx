import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MetaContentMetricsPayload } from '@/meta-platform/types/metaContentTypes';
import { resolveMetaPostThumbnailUrl } from '@/6-0-social-media-performance/lib/resolveMetaPostThumbnailUrl';
import { cn } from '@/shared/lib/utils';

type MetaContentPostRow = MetaContentMetricsPayload['posts'][number];

type MetaContentPostsTableProps = {
  rows: MetaContentPostRow[];
};

type MetricSortKey =
  | 'views'
  | 'likes'
  | 'comments'
  | 'reach'
  | 'shares'
  | 'saves'
  | 'engagement'
  | 'avgWatchTime';

type SortDir = 'asc' | 'desc';

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function formatOptionalCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function formatPercent(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}%`;
}

/** Instagram returns avg watch time in ms; display like the app (`11s`). */
function formatWatchTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  return `${Math.round(ms / 1000)}s`;
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const aMissing = a == null || !Number.isFinite(a);
  const bMissing = b == null || !Number.isFinite(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return (a as number) - (b as number);
}

function PostThumbnail({ row }: { row: MetaContentPostRow }) {
  const initialSrc = resolveMetaPostThumbnailUrl(row);
  const [src, setSrc] = useState<string | null>(initialSrc);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400"
        aria-hidden
      >
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="h-10 w-10 shrink-0 rounded object-cover"
      onError={() => {
        const fallback = resolveMetaPostThumbnailUrl({
          thumbnail_url: row.thumbnail_url,
          media_url: row.media_url === src ? null : row.media_url,
        });
        if (fallback && fallback !== src) {
          setSrc(fallback);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

/** Prefer caption; never fall back to raw Graph media id. */
function resolvePostLabel(row: MetaContentPostRow): string {
  const caption = row.caption?.trim();
  if (caption) return caption;

  const permalink = row.permalink?.trim() ?? '';
  const shortcode =
    permalink.match(/\/(?:reel|reels|p|tv)\/([^/?#]+)/i)?.[1] ??
    permalink.match(/instagram\.com\/([^/?#]+)/i)?.[1];
  if (shortcode && shortcode !== 'reel' && shortcode !== 'p') return shortcode;

  if (row.posted_at) {
    return `${formatDate(row.posted_at)}`;
  }

  return '—';
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
    case 'saves':
      cmp = compareNullableNumber(a.save_count, b.save_count);
      break;
    case 'avgWatchTime':
      cmp = compareNullableNumber(a.avg_watch_time_ms, b.avg_watch_time_ms);
      break;
    case 'engagement': {
      cmp = compareNullableNumber(a.engagement_rate, b.engagement_rate);
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
      <table className="w-full min-w-[1440px] table-fixed text-sm">
        <colgroup>
          <col className="w-[168px]" />
          <col className="w-[160px]" />
          <col className="w-[96px]" />
          <col className="w-[96px]" />
          <col className="w-[88px]" />
          <col className="w-[72px]" />
          <col className="w-[72px]" />
          <col className="w-[96px]" />
          <col className="w-[64px]" />
          <col className="w-[80px]" />
          <col className="w-[64px]" />
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
              label={t('metaPlatform.performance.reach', 'Reach')}
              sortKey="reach"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('digitalMarketing.metaContent.colAvgWatchTime', 'Avg. watch time')}
              sortKey="avgWatchTime"
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
              label={t('digitalMarketing.metaContent.colShares', 'Shares')}
              sortKey="shares"
              activeSortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
            <SortableMetricHeader
              label={t('digitalMarketing.metaContent.colSaved', 'Saved')}
              sortKey="saves"
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
            const label = resolvePostLabel(row);
            return (
              <tr key={row.content_id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="max-w-[168px] overflow-hidden px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <PostThumbnail
                      key={`${row.content_id}:${resolveMetaPostThumbnailUrl(row) ?? ''}`}
                      row={row}
                    />
                    <p className="truncate font-medium text-gray-900" title={label}>
                      {label}
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
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.reach)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatWatchTime(row.avg_watch_time_ms)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.like_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.comment_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.share_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatOptionalCount(row.save_count)}
                </td>
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
