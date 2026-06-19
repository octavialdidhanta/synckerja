import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchThreadReplies,
  fetchThreadsList,
  replyThreadsComment,
  type ThreadsComment,
} from "../../_shared/threadsContentApi.ts";
import {
  requireActiveOrg,
  requireThreadsPlatformConfigured,
  resolveOrgThreadsContent,
  threadsContentJson,
} from "../../_shared/threadsContentAuth.ts";
import {
  dismissThreadsManageCommentsPostHighlight,
  getThreadsManageCommentsInboxState,
  markThreadsManageCommentsCommentRead,
  syncThreadsManageCommentsInboundComments,
  syncThreadsManageCommentsPostBaselines,
} from "../../_shared/threadsManageCommentsInboxState.ts";

function sortComments<T extends { published_at: string | null }>(comments: T[], sort: string): T[] {
  const copy = [...comments];
  copy.sort((a, b) => {
    const aT = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bT = b.published_at ? new Date(b.published_at).getTime() : 0;
    return sort === "oldest" ? aT - bT : bT - aT;
  });
  return copy;
}

function mapCommentRow(row: ThreadsComment) {
  return {
    id: row.id,
    media_id: row.media_id,
    post_id: row.media_id,
    text: row.text,
    author_display_name: row.author_name,
    author_avatar_url: null,
    like_count: row.like_count,
    reply_count: row.reply_count,
    parent_comment_id: row.parent_comment_id,
    published_at: row.published_at,
    is_channel_owner: row.is_owner,
    can_reply: row.can_reply,
  };
}

function parsePostBaselines(body: Record<string, unknown>) {
  const raw = body.posts;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      const media_id = String(item.media_id ?? item.post_id ?? item.id ?? "").trim();
      const comment_count = Number(item.comment_count ?? 0);
      if (!media_id) return null;
      return { media_id, comment_count: Number.isFinite(comment_count) ? comment_count : 0 };
    })
    .filter((row): row is { media_id: string; comment_count: number } => row != null);
}

function parseCommentIds(body: Record<string, unknown>): string[] {
  const raw = body.comment_ids;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id).trim()).filter(Boolean);
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 364);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { start: fmt(start), end: fmt(end) };
}

export async function handleThreadsComments(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  try {
    const platformForbidden = requireThreadsPlatformConfigured();
    if (platformForbidden) return platformForbidden;

    const action = String(body.action ?? "").trim();
    const organizationId = String(body.organization_id ?? "").trim();
    const accountId = String(body.account_id ?? body.threads_user_id ?? "").trim();
    if (!organizationId) return threadsContentJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const resolvedEarly = accountId
      ? await resolveOrgThreadsContent(admin, organizationId, accountId)
      : null;
    const threadsUserId = resolvedEarly?.account.threadsUserId ??
      String(body.threads_user_id ?? "").trim();

    if (action === "getInboxState") {
      if (!threadsUserId) return threadsContentJson({ error: "Missing account_id or threads_user_id" }, 400);
      const state = await getThreadsManageCommentsInboxState(admin, organizationId, threadsUserId);
      return threadsContentJson(state, 200);
    }

    if (action === "syncPostBaselines") {
      if (!threadsUserId) return threadsContentJson({ error: "Missing account_id or threads_user_id" }, 400);
      const posts = parsePostBaselines(body);
      const state = await syncThreadsManageCommentsPostBaselines(
        admin, organizationId, threadsUserId, posts,
      );
      return threadsContentJson(state, 200);
    }

    if (action === "syncInboundComments") {
      if (!threadsUserId) return threadsContentJson({ error: "Missing account_id or threads_user_id" }, 400);
      const mediaId = String(body.media_id ?? body.post_id ?? "").trim();
      if (!mediaId) return threadsContentJson({ error: "Missing media_id" }, 400);
      const commentIds = parseCommentIds(body);
      const state = await syncThreadsManageCommentsInboundComments(
        admin, organizationId, threadsUserId, mediaId, commentIds,
      );
      return threadsContentJson(state, 200);
    }

    if (action === "dismissPostHighlight") {
      if (!threadsUserId) return threadsContentJson({ error: "Missing account_id or threads_user_id" }, 400);
      const mediaId = String(body.media_id ?? body.post_id ?? "").trim();
      if (!mediaId) return threadsContentJson({ error: "Missing media_id" }, 400);
      const state = await dismissThreadsManageCommentsPostHighlight(
        admin, organizationId, threadsUserId, mediaId,
      );
      return threadsContentJson(state, 200);
    }

    if (action === "markCommentEngaged") {
      if (!threadsUserId) return threadsContentJson({ error: "Missing account_id or threads_user_id" }, 400);
      const mediaId = String(body.media_id ?? body.post_id ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!mediaId || !commentId) {
        return threadsContentJson({ error: "Missing media_id or comment_id" }, 400);
      }
      const state = await markThreadsManageCommentsCommentRead(
        admin, organizationId, threadsUserId, mediaId, commentId, userId,
      );
      return threadsContentJson({ ok: true, ...state }, 200);
    }

    const resolved = resolvedEarly ?? await resolveOrgThreadsContent(admin, organizationId, accountId || null);
    if (!resolved) {
      return threadsContentJson({ error: "Threads account not connected" }, 404);
    }

    const { accessToken, account } = resolved;
    const resolvedThreadsUserId = account.threadsUserId;
    const resolvedAccountId = account.instagramBusinessAccountId || account.threadsUserId;

    if (action === "sync_posts" || action === "listPosts" || action === "getCommentPosts") {
      const dr = defaultDateRange();
      try {
        const posts = await fetchThreadsList(accessToken, 50, dr);
        return threadsContentJson({
          posts: posts.map((p) => ({
            id: String(p.id ?? ""),
            media_id: String(p.id ?? ""),
            post_id: String(p.id ?? ""),
            caption: p.caption ?? "",
            title: p.caption ?? "",
            thumbnail_url: p.thumbnail_url ?? null,
            cover_image_url: p.thumbnail_url ?? null,
            media_url: p.media_url ?? null,
            permalink: p.permalink,
            timestamp: p.timestamp,
            posted_at: p.timestamp,
            comment_count: p.comment_count ?? 0,
            like_count: p.like_count ?? 0,
          })),
          threads_user_id: resolvedThreadsUserId,
          account_id: resolvedAccountId,
          account_label: account.accountLabel,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return threadsContentJson({ error: msg, code: "THREADS_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "sync_comments" || action === "listComments") {
      const mediaId = String(body.media_id ?? body.post_id ?? "").trim();
      if (!mediaId) return threadsContentJson({ error: "Missing media_id" }, 400);
      const sort = String(body.sort ?? "newest");
      try {
        const comments = await fetchThreadReplies(accessToken, mediaId);
        const topLevel = comments.filter((c) => !c.parent_comment_id || c.parent_comment_id === mediaId);
        return threadsContentJson({
          comments: sortComments(topLevel.map(mapCommentRow), sort),
          threads_user_id: resolvedThreadsUserId,
          account_id: resolvedAccountId,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return threadsContentJson({ error: msg, code: "THREADS_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "listReplies") {
      const mediaId = String(body.media_id ?? body.post_id ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!mediaId || !commentId) {
        return threadsContentJson({ error: "Missing media_id or comment_id" }, 400);
      }
      const sort = String(body.sort ?? "newest");
      try {
        const comments = await fetchThreadReplies(accessToken, mediaId);
        const replies = comments.filter((c) => c.parent_comment_id === commentId);
        return threadsContentJson({ comments: sortComments(replies.map(mapCommentRow), sort) }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return threadsContentJson({ error: msg, code: "THREADS_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "reply" || action === "replyComment") {
      const mediaId = String(body.media_id ?? body.post_id ?? "").trim();
      const text = String(body.text ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!mediaId || !text) {
        return threadsContentJson({ error: "Missing media_id or text" }, 400);
      }
      try {
        const reply = await replyThreadsComment(
          mediaId,
          text,
          accessToken,
          commentId || undefined,
        );
        const inboxState = commentId
          ? await markThreadsManageCommentsCommentRead(
            admin, organizationId, resolvedThreadsUserId, mediaId, commentId, userId,
          )
          : await getThreadsManageCommentsInboxState(admin, organizationId, resolvedThreadsUserId);
        return threadsContentJson({
          ok: true,
          comment_id: reply.id,
          ...inboxState,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return threadsContentJson({ error: msg, code: "THREADS_CONTENT_API_ERROR", action }, 400);
      }
    }

    return threadsContentJson({ error: "Unknown action", action }, 400);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("threads-content-api comments unhandled:", msg);
    return threadsContentJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
}
