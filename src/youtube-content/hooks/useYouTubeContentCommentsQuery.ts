import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type {
  YouTubeCommentRow,
  YouTubeCommentsListResponse,
} from "@/youtube-content/types/youtubeCommentApiTypes";
import type { ManageCommentsSort } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

export async function fetchYouTubeContentComments(args: {
  organizationId: string;
  channelId: string;
  videoId: string;
  sort?: ManageCommentsSort;
}): Promise<YouTubeCommentsListResponse> {
  const { organizationId, channelId, videoId, sort = "newest" } = args;
  if (!channelId.trim() || !videoId.trim()) {
    throw new Error("Missing channel_id or video_id");
  }
  const { data, error } = await supabase.functions.invoke("youtube-content-comments", {
    body: {
      action: "listComments",
      organization_id: organizationId,
      channel_id: channelId,
      video_id: videoId,
      sort,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as YouTubeCommentsListResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return {
    comments: (payload.comments ?? []) as YouTubeCommentRow[],
    channel_id: payload.channel_id,
    account_label: payload.account_label ?? null,
  };
}

export async function fetchYouTubeContentCommentReplies(args: {
  organizationId: string;
  channelId: string;
  videoId: string;
  commentId: string;
  sort?: ManageCommentsSort;
}): Promise<YouTubeCommentsListResponse> {
  const { organizationId, channelId, videoId, commentId, sort = "newest" } = args;
  const { data, error } = await supabase.functions.invoke("youtube-content-comments", {
    body: {
      action: "listReplies",
      organization_id: organizationId,
      channel_id: channelId,
      video_id: videoId,
      comment_id: commentId,
      sort,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as YouTubeCommentsListResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return {
    comments: (payload.comments ?? []) as YouTubeCommentRow[],
  };
}

export function useYouTubeContentCommentsQuery(args: {
  organizationId: string | null | undefined;
  channelId: string;
  videoId: string | null;
  sort?: ManageCommentsSort;
  enabled?: boolean;
  refetchIntervalMs?: number | false;
}) {
  const {
    organizationId,
    channelId,
    videoId,
    sort = "newest",
    enabled = true,
    refetchIntervalMs = false,
  } = args;
  const queryEnabled = Boolean(organizationId && channelId && videoId && enabled);
  return useQuery({
    queryKey: ["youtube-content-comments", organizationId, channelId, videoId, sort],
    queryFn: async () => {
      if (!organizationId || !channelId || !videoId) return null;
      return fetchYouTubeContentComments({ organizationId, channelId, videoId, sort });
    },
    enabled: queryEnabled,
    staleTime: refetchIntervalMs ? 0 : 60_000,
    placeholderData: keepPreviousData,
    refetchInterval: queryEnabled && refetchIntervalMs ? refetchIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: !refetchIntervalMs,
    refetchOnReconnect: true,
  });
}

export function useYouTubeContentCommentRepliesQuery(args: {
  organizationId: string | null | undefined;
  channelId: string;
  videoId: string | null;
  commentId: string | null;
  sort?: ManageCommentsSort;
  enabled?: boolean;
}) {
  const {
    organizationId,
    channelId,
    videoId,
    commentId,
    sort = "newest",
    enabled = true,
  } = args;
  const queryEnabled = Boolean(organizationId && channelId && videoId && commentId && enabled);
  return useQuery({
    queryKey: ["youtube-content-comment-replies", organizationId, channelId, videoId, commentId, sort],
    queryFn: async () => {
      if (!organizationId || !channelId || !videoId || !commentId) return null;
      return fetchYouTubeContentCommentReplies({
        organizationId,
        channelId,
        videoId,
        commentId,
        sort,
      });
    },
    enabled: queryEnabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
