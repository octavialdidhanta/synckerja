import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type YouTubeManageCommentsInboxPostState = {
  video_id: string;
  last_known_comment_count: number;
  is_highlighted: boolean;
  pinned_at: string | null;
};

export type YouTubeManageCommentsInboundComment = {
  video_id: string;
  comment_id: string;
  detected_at: string;
};

export type YouTubeManageCommentsInboxState = {
  posts: YouTubeManageCommentsInboxPostState[];
  inbound_comments: YouTubeManageCommentsInboundComment[];
  engaged_comment_ids: string[];
};

async function invokeInboxAction(
  organizationId: string,
  channelId: string,
  action: string,
  extra?: Record<string, unknown>,
): Promise<YouTubeManageCommentsInboxState> {
  if (!channelId.trim()) {
    throw new Error("Missing channel_id");
  }
  const { data, error } = await supabase.functions.invoke("youtube-content-comments", {
    body: {
      action,
      organization_id: organizationId,
      channel_id: channelId,
      ...extra,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as YouTubeManageCommentsInboxState & { error?: string; ok?: boolean };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export async function fetchYouTubeManageCommentsInboxState(
  organizationId: string,
  channelId: string,
): Promise<YouTubeManageCommentsInboxState> {
  return invokeInboxAction(organizationId, channelId, "getInboxState");
}

export async function syncYouTubeManageCommentsPostBaselines(
  organizationId: string,
  channelId: string,
  posts: Array<{ video_id: string; comment_count: number }>,
): Promise<YouTubeManageCommentsInboxState> {
  return invokeInboxAction(organizationId, channelId, "syncPostBaselines", { posts });
}

export async function syncYouTubeManageCommentsInboundComments(
  organizationId: string,
  channelId: string,
  videoId: string,
  commentIds: string[],
): Promise<YouTubeManageCommentsInboxState> {
  return invokeInboxAction(organizationId, channelId, "syncInboundComments", {
    video_id: videoId,
    comment_ids: commentIds,
  });
}

export async function dismissYouTubeManageCommentsPostHighlight(
  organizationId: string,
  channelId: string,
  videoId: string,
): Promise<YouTubeManageCommentsInboxState> {
  return invokeInboxAction(organizationId, channelId, "dismissPostHighlight", {
    video_id: videoId,
  });
}

export async function markYouTubeManageCommentsCommentRead(
  organizationId: string,
  channelId: string,
  videoId: string,
  commentId: string,
): Promise<YouTubeManageCommentsInboxState> {
  return invokeInboxAction(organizationId, channelId, "markCommentEngaged", {
    video_id: videoId,
    comment_id: commentId,
    engagement_type: "read",
  });
}
