import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type {
  TikTokCommentRow,
  TikTokCommentsListResponse,
} from "@/tiktok-content/types/tiktokCommentApiTypes";
import type { ManageCommentsSort } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

export async function fetchTikTokContentComments(args: {
  organizationId: string;
  openId: string;
  videoId: string;
  cursor?: number;
  sort?: ManageCommentsSort;
}): Promise<TikTokCommentsListResponse & { account_label?: string | null }> {
  const { organizationId, openId, videoId, cursor = 0, sort = "newest" } = args;
  const { data, error } = await supabase.functions.invoke("tiktok-content-comments", {
    body: {
      action: "listComments",
      organization_id: organizationId,
      open_id: openId,
      video_id: videoId,
      cursor,
      sort,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokCommentsListResponse & { error?: string; account_label?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return {
    comments: (payload.comments ?? []) as TikTokCommentRow[],
    cursor: payload.cursor ?? null,
    has_more: Boolean(payload.has_more),
    account_label: payload.account_label ?? null,
  };
}

export async function fetchTikTokContentCommentReplies(args: {
  organizationId: string;
  openId: string;
  videoId: string;
  commentId: string;
  cursor?: number;
  sort?: ManageCommentsSort;
}): Promise<TikTokCommentsListResponse> {
  const { organizationId, openId, videoId, commentId, cursor = 0, sort = "newest" } = args;
  const { data, error } = await supabase.functions.invoke("tiktok-content-comments", {
    body: {
      action: "listReplies",
      organization_id: organizationId,
      open_id: openId,
      video_id: videoId,
      comment_id: commentId,
      cursor,
      sort,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokCommentsListResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return {
    comments: (payload.comments ?? []) as TikTokCommentRow[],
    cursor: payload.cursor ?? null,
    has_more: Boolean(payload.has_more),
  };
}

export function useTikTokContentCommentsQuery(args: {
  organizationId: string | null | undefined;
  openId: string;
  videoId: string | null;
  sort?: ManageCommentsSort;
  enabled?: boolean;
  /** Poll TikTok for new inbound comments (ms). Set false to disable. */
  refetchIntervalMs?: number | false;
}) {
  const {
    organizationId,
    openId,
    videoId,
    sort = "newest",
    enabled = true,
    refetchIntervalMs = false,
  } = args;
  const queryEnabled = Boolean(organizationId && openId && videoId && enabled);
  return useQuery({
    queryKey: ["tiktok-content-comments", "v3", organizationId, openId, videoId, sort],
    queryFn: async () => {
      if (!organizationId || !openId || !videoId) return null;
      return fetchTikTokContentComments({
        organizationId,
        openId,
        videoId,
        sort,
      });
    },
    enabled: queryEnabled,
    staleTime: refetchIntervalMs ? 0 : 60_000,
    placeholderData: keepPreviousData,
    refetchInterval: queryEnabled && refetchIntervalMs ? refetchIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useTikTokContentCommentRepliesQuery(args: {
  organizationId: string | null | undefined;
  openId: string;
  videoId: string | null;
  commentId: string | null;
  sort?: ManageCommentsSort;
  enabled?: boolean;
  refetchIntervalMs?: number | false;
}) {
  const {
    organizationId,
    openId,
    videoId,
    commentId,
    sort = "newest",
    enabled = true,
    refetchIntervalMs = false,
  } = args;
  const queryEnabled = Boolean(organizationId && openId && videoId && commentId && enabled);
  return useQuery({
    queryKey: ["tiktok-content-comment-replies", "v3", organizationId, openId, videoId, commentId, sort],
    queryFn: async () => {
      if (!organizationId || !openId || !videoId || !commentId) return null;
      return fetchTikTokContentCommentReplies({
        organizationId,
        openId,
        videoId,
        commentId,
        sort,
      });
    },
    enabled: queryEnabled,
    staleTime: refetchIntervalMs ? 0 : 60_000,
    placeholderData: keepPreviousData,
    refetchInterval: queryEnabled && refetchIntervalMs ? refetchIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
