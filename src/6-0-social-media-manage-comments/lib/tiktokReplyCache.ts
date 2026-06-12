import type { QueryClient } from "@tanstack/react-query";
import type { TikTokCommentRow } from "@/tiktok-content/types/tiktokCommentApiTypes";
import type { TikTokCommentsListResponse } from "@/tiktok-content/types/tiktokCommentApiTypes";
import {
  MANAGE_COMMENTS_BURST_MAX_ATTEMPTS,
  MANAGE_COMMENTS_BURST_POLL_MS,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsPolling";

export function tiktokCommentRepliesQueryKey(
  organizationId: string,
  openId: string,
  videoId: string,
  parentCommentId: string,
  sort = "newest",
) {
  return [
    "tiktok-content-comment-replies",
    "v3",
    organizationId,
    openId,
    videoId,
    parentCommentId,
    sort,
  ] as const;
}

export function appendReplyToCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  reply: TikTokCommentRow,
) {
  queryClient.setQueryData<TikTokCommentsListResponse | null>(queryKey, (old) => {
    if (!old) {
      return { comments: [reply], cursor: null, has_more: false };
    }
    if (old.comments.some((c) => c.id === reply.id)) return old;
    return {
      ...old,
      comments: [reply, ...old.comments],
    };
  });
}

export function buildOptimisticReplyRow(args: {
  commentId: string;
  text: string;
  accountLabel: string;
  parentCommentId: string;
}): TikTokCommentRow {
  return {
    id: args.commentId,
    text: args.text,
    like_count: 0,
    reply_count: 0,
    parent_comment_id: args.parentCommentId,
    create_time: Math.floor(Date.now() / 1000),
    display_name: args.accountLabel,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll replies until server returns matching text or attempts exhausted. */
export async function burstRefetchRepliesUntilFound(args: {
  queryClient: QueryClient;
  organizationId: string;
  openId: string;
  videoId: string;
  parentCommentId: string;
  text: string;
  onFound?: (serverTexts: string[]) => void;
}) {
  const { queryClient, organizationId, openId, videoId, parentCommentId, text, onFound } =
    args;
  const prefix = [
    "tiktok-content-comment-replies",
    "v3",
    organizationId,
    openId,
    videoId,
    parentCommentId,
  ];

  for (let attempt = 0; attempt < MANAGE_COMMENTS_BURST_MAX_ATTEMPTS; attempt++) {
    await queryClient.refetchQueries({ queryKey: prefix });
    const entries = queryClient.getQueriesData<TikTokCommentsListResponse | null>({
      queryKey: prefix,
    });
    const serverTexts = entries.flatMap(([, data]) =>
      (data?.comments ?? []).map((c) => c.text),
    );
    if (serverTexts.some((s) => s.trim() === text.trim())) {
      onFound?.(serverTexts);
      return true;
    }
    if (attempt < MANAGE_COMMENTS_BURST_MAX_ATTEMPTS - 1) {
      await sleep(MANAGE_COMMENTS_BURST_POLL_MS);
    }
  }
  return false;
}
