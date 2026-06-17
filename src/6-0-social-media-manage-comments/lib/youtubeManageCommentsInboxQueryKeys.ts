export const YOUTUBE_MANAGE_COMMENTS_INBOX_STATE_QUERY_KEY = "youtube-manage-comments-inbox-state";

export function youtubeManageCommentsInboxStateQueryKey(
  organizationId: string | null | undefined,
  channelId: string | null | undefined,
) {
  return [YOUTUBE_MANAGE_COMMENTS_INBOX_STATE_QUERY_KEY, organizationId, channelId] as const;
}
