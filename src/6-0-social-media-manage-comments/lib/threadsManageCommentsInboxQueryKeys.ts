export const THREADS_MANAGE_COMMENTS_INBOX_STATE_QUERY_KEY = 'threads-manage-comments-inbox-state';

export function threadsManageCommentsInboxStateQueryKey(
  organizationId: string | null | undefined,
  accountId: string | null | undefined,
) {
  return [THREADS_MANAGE_COMMENTS_INBOX_STATE_QUERY_KEY, organizationId, accountId] as const;
}
