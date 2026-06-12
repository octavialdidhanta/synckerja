import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type ManageCommentsInboxPostState = {
  video_id: string;
  last_known_comment_count: number;
  is_highlighted: boolean;
  pinned_at: string | null;
};

export type ManageCommentsInboundComment = {
  video_id: string;
  comment_id: string;
  detected_at: string;
};

export type ManageCommentsInboxState = {
  posts: ManageCommentsInboxPostState[];
  inbound_comments: ManageCommentsInboundComment[];
  engaged_comment_ids: string[];
};

async function invokeInboxAction(
  organizationId: string,
  openId: string,
  action: string,
  extra?: Record<string, unknown>,
): Promise<ManageCommentsInboxState> {
  const { data, error } = await supabase.functions.invoke("tiktok-content-comments", {
    body: {
      action,
      organization_id: organizationId,
      open_id: openId,
      ...extra,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as ManageCommentsInboxState & { error?: string; ok?: boolean };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export async function fetchManageCommentsInboxState(
  organizationId: string,
  openId: string,
): Promise<ManageCommentsInboxState> {
  return invokeInboxAction(organizationId, openId, "getInboxState");
}

export async function syncManageCommentsPostBaselines(
  organizationId: string,
  openId: string,
  posts: Array<{ video_id: string; comment_count: number }>,
): Promise<ManageCommentsInboxState> {
  return invokeInboxAction(organizationId, openId, "syncPostBaselines", { posts });
}

export async function syncManageCommentsInboundComments(
  organizationId: string,
  openId: string,
  videoId: string,
  commentIds: string[],
): Promise<ManageCommentsInboxState> {
  return invokeInboxAction(organizationId, openId, "syncInboundComments", {
    video_id: videoId,
    comment_ids: commentIds,
  });
}

export async function dismissManageCommentsPostHighlight(
  organizationId: string,
  openId: string,
  videoId: string,
): Promise<ManageCommentsInboxState> {
  return invokeInboxAction(organizationId, openId, "dismissPostHighlight", {
    video_id: videoId,
  });
}
