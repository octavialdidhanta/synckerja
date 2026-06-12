import { useMemo } from "react";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";

import { supabase } from "@/shared/lib/supabaseClient";

import type { TikTokContentVideoRow } from "@/tiktok-content/hooks/useTikTokContentVideosQuery";

import {

  MANAGE_COMMENTS_POSTS_POLL_MS,

} from "@/6-0-social-media-manage-comments/lib/manageCommentsPolling";

import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";



type CommentInboxVideosResponse = {

  rows: TikTokContentVideoRow[];

  summary?: {

    video_count: number;

    total_comments: number;

  };

  open_id: string;

  account_label: string | null;

  inbox_mode?: boolean;

  cached?: boolean;

};



function toPostListItem(

  row: TikTokContentVideoRow,

  accountAvatarUrl: string | null,

  accountLabel: string,

): ManageCommentsPostListItem {

  const title = row.title?.trim() || "Untitled video";

  const snippet =

    row.comment_count > 0

      ? `${row.comment_count} comment${row.comment_count === 1 ? "" : "s"}`

      : "There are no user comments on this post yet";

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



async function fetchTikTokContentCommentInboxPosts(args: {

  organizationId: string;

  openId: string;

  forceRefresh?: boolean;

}): Promise<CommentInboxVideosResponse> {

  const { organizationId, openId, forceRefresh = false } = args;

  const { data, error } = await supabase.functions.invoke("tiktok-content-metrics", {

    body: {

      organization_id: organizationId,

      open_id: openId,

      inbox_mode: true,

      force_refresh: forceRefresh,

    },

  });

  if (error) throw await parseEdgeFunctionError(error, data);

  const payload = data as CommentInboxVideosResponse & { error?: string };

  if (payload?.error) throw await parseEdgeFunctionError(null, payload);

  return payload;

}



/** Manage Comments inbox — all account videos, independent of the global date picker. */

export function useTikTokContentCommentPostsQuery(args: {

  organizationId: string | null | undefined;

  openId: string;

  accountAvatarUrl?: string | null;

  accountLabel?: string | null;

  enabled?: boolean;

  liveRefresh?: boolean;

}) {

  const {

    organizationId,

    openId,

    accountAvatarUrl = null,

    accountLabel = "TikTok",

    enabled = true,

    liveRefresh = true,

  } = args;



  const queryEnabled = Boolean(organizationId && openId && enabled);



  const query = useQuery({

    queryKey: ["tiktok-content-comment-posts", organizationId, openId],

    queryFn: async () => {

      if (!organizationId || !openId) return null;

      return fetchTikTokContentCommentInboxPosts({

        organizationId,

        openId,

        forceRefresh: liveRefresh,

      });

    },

    enabled: queryEnabled,

    staleTime: liveRefresh ? 0 : 60_000,

    placeholderData: keepPreviousData,

    refetchInterval: queryEnabled && liveRefresh ? MANAGE_COMMENTS_POSTS_POLL_MS : false,

    refetchIntervalInBackground: false,

  });



  const data = useMemo(() => {

    if (!query.data) return null;

    const label = query.data.account_label?.trim() || accountLabel || "TikTok";

    const posts = query.data.rows.map((row) =>

      toPostListItem(row, accountAvatarUrl, label),

    );

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

  };

}

