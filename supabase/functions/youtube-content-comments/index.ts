/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  hasYouTubeCommentsOAuthScope,
  requireActiveOrg,
  requireYouTubeContentPlatformConfigured,
  youtubeContentCorsHeaders,
  youtubeContentJson,
} from "../_shared/youtubeContentAuth.ts";
import {
  fetchYouTubeCommentReplies,
  fetchYouTubeCommentThreads,
  fetchGoogleTokenScopes,
  insertYouTubeCommentReply,
  insertYouTubeTopLevelComment,
} from "../_shared/youtubeContentApi.ts";
import { resolveOrgYouTubeContentForMetrics } from "../_shared/youtubeContentOrgResolver.ts";
import {
  dismissYouTubeManageCommentsPostHighlight,
  getYouTubeManageCommentsInboxState,
  markYouTubeManageCommentsCommentRead,
  syncYouTubeManageCommentsInboundComments,
  syncYouTubeManageCommentsPostBaselines,
} from "../_shared/youtubeManageCommentsInboxState.ts";

function sortComments<T extends { published_at: string | null }>(
  comments: T[],
  sort: string,
): T[] {
  const copy = [...comments];
  copy.sort((a, b) => {
    const aT = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bT = b.published_at ? new Date(b.published_at).getTime() : 0;
    return sort === "oldest" ? aT - bT : bT - aT;
  });
  return copy;
}

function parsePostBaselines(body: Record<string, unknown>) {
  const raw = body.posts;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      const video_id = String(item.video_id ?? item.id ?? "").trim();
      const comment_count = Number(item.comment_count ?? 0);
      if (!video_id) return null;
      return { video_id, comment_count: Number.isFinite(comment_count) ? comment_count : 0 };
    })
    .filter((row): row is { video_id: string; comment_count: number } => row != null);
}

function parseCommentIds(body: Record<string, unknown>): string[] {
  const raw = body.comment_ids;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id).trim()).filter(Boolean);
}

function mapCommentRow(row: {
  id: string;
  video_id: string;
  text: string;
  author_display_name: string;
  author_avatar_url: string | null;
  like_count: number;
  reply_count: number;
  parent_comment_id: string | null;
  published_at: string | null;
  is_channel_owner: boolean;
  thread_id?: string | null;
  reply_parent_id?: string | null;
  can_reply?: boolean;
}) {
  const publishedAt = row.published_at;
  const createTime = publishedAt ? Math.floor(new Date(publishedAt).getTime() / 1000) : null;
  return {
    id: row.id,
    video_id: row.video_id,
    text: row.text,
    display_name: row.author_display_name,
    avatar_url: row.author_avatar_url,
    like_count: row.like_count,
    reply_count: row.reply_count,
    parent_comment_id: row.parent_comment_id,
    create_time: Number.isFinite(createTime) ? createTime : null,
    published_at: publishedAt,
    is_channel_owner: row.is_channel_owner,
    thread_id: row.thread_id ?? null,
    reply_parent_id: row.reply_parent_id ?? row.id,
    can_reply: row.can_reply !== false,
  };
}

function mapYouTubeApiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (lower.includes("belongs to youtube channel") || lower.includes("not the selected channel")) {
    return `youtube_comments_wrong_channel: ${msg}`;
  }
  if (lower.includes("http 403") || lower.includes("403") || lower.includes("insufficient") || lower.includes("forbidden")) {
    return "youtube_comments_forbidden: YouTube rejected comment access. Disconnect and reconnect the channel in settings to grant the youtube.force-ssl scope.";
  }
  if (lower.includes("comments disabled") || lower.includes("disabled comments") || lower.includes("commenting disabled")) {
    return "youtube_comments_disabled: Comments are disabled on this video.";
  }
  if (lower.includes("quota") || lower.includes("dailylimitexceeded")) {
    return "youtube_comments_quota: YouTube API quota exceeded. Try again later or request a quota increase in Google Cloud Console.";
  }
  if (lower.includes("not found") || lower.includes("http 404")) {
    return "youtube_comments_not_found: Video not found or comments are not available for this video.";
  }
  if (lower.includes("operationnotsupported") || lower.includes("cannot reply")) {
    return "youtube_comments_reply_blocked: YouTube does not allow replies on this comment thread.";
  }
  if (lower.includes("parentcommentisprivate")) {
    return "youtube_comments_reply_blocked: Cannot reply to a private comment.";
  }
  if (lower.includes("processingfailure")) {
    return "youtube_comments_reply_failed: YouTube could not post this reply. Refresh comments and try again.";
  }
  return msg;
}

async function apiErrorResponse(
  action: string,
  e: unknown,
  accessToken?: string,
): Promise<Response> {
  let error = mapYouTubeApiError(e);
  if (accessToken) {
    const scopes = await fetchGoogleTokenScopes(accessToken).catch(() => []);
    if (scopes.length > 0 && !hasYouTubeCommentsOAuthScope(scopes)) {
      error += " Token is missing youtube.force-ssl — reconnect the channel in settings.";
    }
  }
  console.error(`youtube-content-comments ${action} API error:`, error);
  return youtubeContentJson({ error, code: "YOUTUBE_CONTENT_API_ERROR", action }, 400);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: youtubeContentCorsHeaders });
    }
    if (req.method !== "POST") {
      return youtubeContentJson({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return youtubeContentJson({ error: "Server misconfigured" }, 500);
    }

    const platformForbidden = requireYouTubeContentPlatformConfigured();
    if (platformForbidden) return platformForbidden;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return youtubeContentJson({ error: "Invalid JSON body" }, 400);
    }

    const action = String(body.action ?? "").trim();
    const organizationId = String(body.organization_id ?? "").trim();
    const channelId = String(body.channel_id ?? "").trim();
    if (!organizationId) return youtubeContentJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    if (action === "getInboxState") {
      if (!channelId) return youtubeContentJson({ error: "Missing channel_id" }, 400);
      const state = await getYouTubeManageCommentsInboxState(admin, organizationId, channelId);
      return youtubeContentJson(state, 200);
    }

    if (action === "syncPostBaselines") {
      if (!channelId) return youtubeContentJson({ error: "Missing channel_id" }, 400);
      const posts = parsePostBaselines(body);
      const state = await syncYouTubeManageCommentsPostBaselines(admin, organizationId, channelId, posts);
      return youtubeContentJson(state, 200);
    }

    if (action === "syncInboundComments") {
      if (!channelId) return youtubeContentJson({ error: "Missing channel_id" }, 400);
      const videoId = String(body.video_id ?? "").trim();
      if (!videoId) return youtubeContentJson({ error: "Missing video_id" }, 400);
      const commentIds = parseCommentIds(body);
      const state = await syncYouTubeManageCommentsInboundComments(
        admin,
        organizationId,
        channelId,
        videoId,
        commentIds,
      );
      return youtubeContentJson(state, 200);
    }

    if (action === "dismissPostHighlight") {
      if (!channelId) return youtubeContentJson({ error: "Missing channel_id" }, 400);
      const videoId = String(body.video_id ?? "").trim();
      if (!videoId) return youtubeContentJson({ error: "Missing video_id" }, 400);
      const state = await dismissYouTubeManageCommentsPostHighlight(
        admin,
        organizationId,
        channelId,
        videoId,
      );
      return youtubeContentJson(state, 200);
    }

    if (action === "markCommentEngaged") {
      if (!channelId) return youtubeContentJson({ error: "Missing channel_id" }, 400);
      const videoId = String(body.video_id ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!videoId || !commentId) {
        return youtubeContentJson({ error: "Missing video_id or comment_id" }, 400);
      }
      const state = await markYouTubeManageCommentsCommentRead(
        admin,
        organizationId,
        channelId,
        videoId,
        commentId,
        userRes.userId,
      );
      return youtubeContentJson({ ok: true, ...state }, 200);
    }

    const resolved = await resolveOrgYouTubeContentForMetrics(
      admin,
      organizationId,
      channelId || null,
    );
    if (!resolved) {
      return youtubeContentJson({ error: "YouTube channel not connected" }, 404);
    }

    const { accessToken, account } = resolved;
    const accountChannelId = account.channel_id;
    const accountLabel = account.label || account.display_name || accountChannelId;

    if (action === "listComments") {
      const videoId = String(body.video_id ?? "").trim();
      if (!videoId) return youtubeContentJson({ error: "Missing video_id" }, 400);
      const sort = String(body.sort ?? "newest");
      try {
        const threads = await fetchYouTubeCommentThreads(accessToken, accountChannelId, videoId);
        return youtubeContentJson({
          comments: sortComments(threads.map(mapCommentRow), sort),
          channel_id: accountChannelId,
          account_label: accountLabel,
        }, 200);
      } catch (e) {
        return await apiErrorResponse("listComments", e, accessToken);
      }
    }

    if (action === "listReplies") {
      const commentId = String(body.comment_id ?? "").trim();
      const videoId = String(body.video_id ?? "").trim();
      if (!commentId || !videoId) {
        return youtubeContentJson({ error: "Missing comment_id or video_id" }, 400);
      }
      const sort = String(body.sort ?? "newest");
      try {
        const replies = await fetchYouTubeCommentReplies(accessToken, accountChannelId, commentId);
        return youtubeContentJson({
          comments: sortComments(replies.map(mapCommentRow), sort),
        }, 200);
      } catch (e) {
        return await apiErrorResponse("listReplies", e, accessToken);
      }
    }

    if (action === "replyComment") {
      const scopes = await fetchGoogleTokenScopes(accessToken).catch(() => []);
      if (scopes.length > 0 && !hasYouTubeCommentsOAuthScope(scopes)) {
        return youtubeContentJson({
          error:
            "youtube_comments_forbidden: Reconnect the channel in settings to grant the youtube.force-ssl scope required to post replies.",
          code: "YOUTUBE_CONTENT_API_ERROR",
          action,
        }, 400);
      }

      const videoId = String(body.video_id ?? "").trim();
      const text = String(body.text ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      const threadId = body.thread_id != null ? String(body.thread_id).trim() : "";
      const targetParentCommentId = body.target_parent_comment_id != null
        ? String(body.target_parent_comment_id).trim()
        : "";
      if (!videoId || !text) {
        return youtubeContentJson({ error: "Missing video_id or text" }, 400);
      }
      if (!commentId) {
        return youtubeContentJson({
          error: "Missing comment_id — click Reply on a comment first",
        }, 400);
      }

      try {
        const reply = await insertYouTubeCommentReply(
          accessToken,
          accountChannelId,
          videoId,
          commentId,
          text,
          {
            threadId: threadId || null,
            topLevelCommentId: targetParentCommentId || commentId,
          },
        );
        const inboxState = await markYouTubeManageCommentsCommentRead(
          admin,
          organizationId,
          accountChannelId,
          videoId,
          commentId,
          userRes.userId,
        );
        return youtubeContentJson({
          ok: true,
          comment_id: reply.id,
          comment: mapCommentRow(reply),
          ...inboxState,
        }, 200);
      } catch (e) {
        return await apiErrorResponse("replyComment", e, accessToken);
      }
    }

    if (action === "insertComment") {
      const scopes = await fetchGoogleTokenScopes(accessToken).catch(() => []);
      if (scopes.length > 0 && !hasYouTubeCommentsOAuthScope(scopes)) {
        return youtubeContentJson({
          error:
            "youtube_comments_forbidden: Reconnect the channel in settings to grant the youtube.force-ssl scope required to post comments.",
          code: "YOUTUBE_CONTENT_API_ERROR",
          action,
        }, 400);
      }

      const videoId = String(body.video_id ?? "").trim();
      const text = String(body.text ?? "").trim();
      if (!videoId || !text) {
        return youtubeContentJson({ error: "Missing video_id or text" }, 400);
      }

      try {
        const comment = await insertYouTubeTopLevelComment(
          accessToken,
          accountChannelId,
          videoId,
          text,
        );
        return youtubeContentJson({
          ok: true,
          comment_id: comment.id,
          comment: mapCommentRow(comment),
        }, 200);
      } catch (e) {
        return await apiErrorResponse("insertComment", e, accessToken);
      }
    }

    return youtubeContentJson({ error: "Unknown action", action }, 400);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("youtube-content-comments unhandled:", msg);
    return youtubeContentJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
});
