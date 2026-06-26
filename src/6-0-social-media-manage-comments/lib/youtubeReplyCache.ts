import type { QueryClient } from "@tanstack/react-query";
import { fetchYouTubeContentCommentReplies } from "@/youtube-content/hooks/useYouTubeContentCommentsQuery";
import type {
  YouTubeCommentRow,
  YouTubeCommentsListResponse,
} from "@/youtube-content/types/youtubeCommentApiTypes";
import type { YouTubeContentVideoRow } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";
import {
  MANAGE_COMMENTS_BURST_MAX_ATTEMPTS,
  MANAGE_COMMENTS_BURST_POLL_MS,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsPolling";

type YouTubeCommentPostsCache = {
  rows: YouTubeContentVideoRow[];
};

export function youtubeCommentRepliesQueryKey(
  organizationId: string,
  channelId: string,
  videoId: string,
  parentCommentId: string,
  sort = "newest",
) {
  return [
    "youtube-content-comment-replies",
    organizationId,
    channelId,
    videoId,
    parentCommentId,
    sort,
  ] as const;
}

function sortYouTubeRepliesNewest(comments: YouTubeCommentRow[]) {
  return [...comments].sort((a, b) => (b.create_time ?? 0) - (a.create_time ?? 0));
}

export function mergeYouTubeRepliesIntoCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  serverRows: YouTubeCommentRow[],
) {
  queryClient.setQueryData<YouTubeCommentsListResponse | null>(queryKey, (old) => {
    const merged = new Map<string, YouTubeCommentRow>();
    for (const row of old?.comments ?? []) merged.set(row.id, row);
    for (const row of serverRows) merged.set(row.id, row);
    return { comments: sortYouTubeRepliesNewest([...merged.values()]) };
  });
}

export function appendYouTubeReplyToCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  reply: YouTubeCommentRow,
) {
  mergeYouTubeRepliesIntoCache(queryClient, queryKey, [reply]);
}

export function buildOptimisticYouTubeReplyRow(args: {
  commentId: string;
  text: string;
  accountLabel: string;
  parentCommentId: string;
  videoId: string;
}): YouTubeCommentRow {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: args.commentId,
    video_id: args.videoId,
    text: args.text,
    display_name: args.accountLabel,
    avatar_url: null,
    like_count: 0,
    reply_count: 0,
    parent_comment_id: args.parentCommentId,
    create_time: now,
    published_at: new Date(now * 1000).toISOString(),
    is_channel_owner: true,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function burstRefetchYouTubeRepliesUntilFound(args: {
  queryClient: QueryClient;
  organizationId: string;
  channelId: string;
  videoId: string;
  parentCommentId: string;
  text: string;
  onFound?: (serverTexts: string[]) => void;
}) {
  const { queryClient, organizationId, channelId, videoId, parentCommentId, text, onFound } =
    args;
  const repliesKey = youtubeCommentRepliesQueryKey(
    organizationId,
    channelId,
    videoId,
    parentCommentId,
  );

  for (let attempt = 0; attempt < MANAGE_COMMENTS_BURST_MAX_ATTEMPTS; attempt++) {
    try {
      const data = await fetchYouTubeContentCommentReplies({
        organizationId,
        channelId,
        videoId,
        commentId: parentCommentId,
      });
      mergeYouTubeRepliesIntoCache(queryClient, repliesKey, data.comments);
      const serverTexts = data.comments.map((c) => c.text);
      if (serverTexts.some((s) => s.trim() === text.trim())) {
        onFound?.(serverTexts);
        return true;
      }
    } catch {
      // YouTube may not list the reply immediately after insert.
    }
    if (attempt < MANAGE_COMMENTS_BURST_MAX_ATTEMPTS - 1) {
      await sleep(MANAGE_COMMENTS_BURST_POLL_MS);
    }
  }
  return false;
}

export function patchYouTubeCommentPostsCount(
  queryClient: QueryClient,
  organizationId: string,
  channelId: string,
  videoId: string,
  commentCount: number,
) {
  if (!videoId || commentCount <= 0) return;
  queryClient.setQueryData<YouTubeCommentPostsCache | null>(
    ["youtube-content-comment-posts", organizationId, channelId],
    (old) => {
      if (!old?.rows?.length) return old;
      let changed = false;
      const rows = old.rows.map((row) => {
        if (row.video_id !== videoId) return row;
        const next = Math.max(Number(row.comment_count) || 0, commentCount);
        if (next === row.comment_count) return row;
        changed = true;
        return { ...row, comment_count: next };
      });
      return changed ? { ...old, rows } : old;
    },
  );
}
