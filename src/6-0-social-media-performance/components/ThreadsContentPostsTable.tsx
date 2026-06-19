import { useTranslation } from 'react-i18next';
import type { ThreadsContentPostRow } from '@/threads-content/hooks/useThreadsContentMetrics';

type ThreadsContentPostsTableProps = {
  rows: ThreadsContentPostRow[];
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

export function ThreadsContentPostsTable({ rows }: ThreadsContentPostsTableProps) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {t('digitalMarketing.threadsContent.noPosts', 'No Threads posts in this date range.')}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-gray-100 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t('digitalMarketing.threadsContent.colPost', 'Post')}</th>
            <th className="px-4 py-2 font-medium">{t('digitalMarketing.threadsContent.colDate', 'Date')}</th>
            <th className="px-4 py-2 font-medium text-right">{t('digitalMarketing.threadsContent.colViews', 'Views')}</th>
            <th className="px-4 py-2 font-medium text-right">{t('digitalMarketing.threadsContent.colLikes', 'Likes')}</th>
            <th className="px-4 py-2 font-medium text-right">{t('digitalMarketing.threadsContent.colComments', 'Comments')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.content_id} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="max-w-[280px] truncate px-4 py-2 font-medium text-gray-900">
                {row.caption?.trim() || row.content_id}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{formatDate(row.posted_at)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCount(row.view_count)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCount(row.like_count)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCount(row.comment_count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
