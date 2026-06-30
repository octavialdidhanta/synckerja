export const META_MANAGE_COMMENTS_INBOX_STATE_QUERY_KEY = 'meta-manage-comments-inbox-state';

export function metaManageCommentsInboxStateQueryKey(
  organizationId: string | null | undefined,
  platform: string | null | undefined,
  accountId: string | null | undefined,
) {
  return [META_MANAGE_COMMENTS_INBOX_STATE_QUERY_KEY, organizationId, platform, accountId] as const;
}
