export const MANAGE_COMMENTS_INBOX_STATE_QUERY_KEY = "manage-comments-inbox-state";

export function manageCommentsInboxStateQueryKey(
  organizationId: string | null | undefined,
  openId: string | null | undefined,
) {
  return [MANAGE_COMMENTS_INBOX_STATE_QUERY_KEY, organizationId, openId] as const;
}
