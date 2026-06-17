import { useCallback, useMemo, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { YouTubeContentVideoRow } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";
import { YOUTUBE_MANAGE_COMMENTS_POSTS_POLL_MS } from "@/6-0-social-media-manage-comments/lib/manageCommentsPolling";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type CommentInboxVideosResponse = {
  rows: YouTubeContentVideoRow[];
  summary?: { video_count: number; total_comments: number };
  channel_id: string;
  account_label: string | null;
  inbox_mode?: boolean;
  cached?: boolean;
};

function toPostListItem(
  row: YouTubeContentVideoRow,
  accountAvatarUrl: string | null,
  accountLabel: string,
): ManageCommentsPostListItem {
  const title = row.title?.trim() || "Untitled video";
  const snippet =
    row.comment_count > 0
      ? `${row.comment_count} comment${row.comment_count === 1 ? "" : "s"}`
      : "There are no user comments on this video yet";

  return {
    id: row.video_id,
    title,
    snippet,
    coverImageUrl: row.cover_image_url,
    postedAt: row.posted_at,
    commentCount: row.comment_count,
    likeCount: row.like_count,
    viewCount: row.view_count,
    shareUrl: row.share_url,
    duration: row.duration ?? null,
    accountAvatarUrl,
    accountLabel,
  };
}

async function fetchYouTubeContentCommentInboxPosts(args: {
  organizationId: string;
  channelId: string;
  forceRefresh?: boolean;
}): Promise<CommentInboxVideosResponse> {
  const { organizationId, channelId, forceRefresh = false } = args;
  const { data, error } = await supabase.functions.invoke("youtube-content-metrics", {
    body: {
      organization_id: organizationId,
      channel_id: channelId,
      inbox_mode: true,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as CommentInboxVideosResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useYouTubeContentCommentPostsQuery(args: {
  organizationId: string | null | undefined;
  channelId: string;
  accountAvatarUrl?: string | null;
  accountLabel?: string | null;
  enabled?: boolean;
  liveRefresh?: boolean;
}) {
  const {
    organizationId,
    channelId,
    accountAvatarUrl = null,
    accountLabel = "YouTube",
    enabled = true,
    liveRefresh = true,
  } = args;

  const queryEnabled = Boolean(organizationId && channelId && enabled);
  const forceRefreshNextRef = useRef(false);

  const query = useQuery({
    queryKey: ["youtube-content-comment-posts", organizationId, channelId],
    queryFn: async () => {
      if (!organizationId || !channelId) return null;
      const forceRefresh = forceRefreshNextRef.current;
      forceRefreshNextRef.current = false;
      return fetchYouTubeContentCommentInboxPosts({
        organizationId,
        channelId,
        forceRefresh,
      });
    },
    enabled: queryEnabled,
    staleTime: liveRefresh ? YOUTUBE_MANAGE_COMMENTS_POSTS_POLL_MS : 60_000,
    placeholderData: keepPreviousData,
    refetchInterval: queryEnabled && liveRefresh ? YOUTUBE_MANAGE_COMMENTS_POSTS_POLL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  const refetchWithForce = useCallback(() => {
    forceRefreshNextRef.current = true;
    return query.refetch();
  }, [query.refetch]);

  const data = useMemo(() => {
    if (!query.data) return null;
    const label = query.data.account_label?.trim() || accountLabel || "YouTube";
    const posts = query.data.rows.map((row) => toPostListItem(row, accountAvatarUrl, label));
    return {
      posts,
      summary: query.data.summary,
      accountLabel: label,
      totalPosts: posts.length,
    };
  }, [query.data, accountAvatarUrl, accountLabel]);

  return {
    ...query,
    data,
    refetchWithForce,
  };
}
