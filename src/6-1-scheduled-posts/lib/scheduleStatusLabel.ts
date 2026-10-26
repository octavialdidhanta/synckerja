import type { ScheduledPostStatus } from '../types/scheduled-post';

const STATUS_LABEL: Record<ScheduledPostStatus, string> = {
  pending: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/**
 * publishing + step = still working.
 * pending + publish_stalled = recovery queued a retry.
 * published / failed stay terminal.
 */
export function scheduleStatusLabel(
  status: ScheduledPostStatus,
  hints?: { publishStep?: unknown; errorMessage?: string | null },
): string {
  if (status === 'pending' && String(hints?.errorMessage ?? '').startsWith('publish_stalled')) {
    return 'Retrying';
  }
  if (status === 'publishing') {
    const step = String(hints?.publishStep ?? '').trim();
    if (step === 'queued') return 'Waiting';
    if (step === 'downloading') return 'Downloading';
    if (step === 'uploading') return 'Uploading';
    if (step === 'processing') return 'Processing';
  }
  return STATUS_LABEL[status];
}
