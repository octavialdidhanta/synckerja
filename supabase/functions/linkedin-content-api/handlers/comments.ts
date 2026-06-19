import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchLinkedInComments,
  fetchLinkedInOrganizationPosts,
  replyLinkedInComment,
} from "../../_shared/linkedinContentApi.ts";
import {
  requireActiveOrg,
  requireLinkedInContentPlatformConfigured,
  linkedinContentJson,
} from "../../_shared/linkedinContentAuth.ts";
import { resolveOrgLinkedInContentForMetrics } from "../../_shared/linkedinContentOrgResolver.ts";
import {
  dismissLinkedInManageCommentsPostHighlight,
  getLinkedInManageCommentsInboxState,
  markLinkedInManageCommentsCommentRead,
  syncLinkedInManageCommentsInboundComments,
  syncLinkedInManageCommentsPostBaselines,
} from "../../_shared/linkedinManageCommentsInboxState.ts";

function sortComments<T extends { published_at: string | null }>(comments: T[], sort: string): T[] {
  const copy = [...comments];
  copy.sort((a, b) => {
    const aT = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bT = b.published_at ? new Date(b.published_at).getTime() : 0;
    return sort === "oldest" ? aT - bT : bT - aT;
  });
  return copy;
}

function mapCommentRow(row: {
  id: string;
  post_id: string;
  text: string;
  author_name: string | null;
  like_count: number;
  reply_count: number;
  parent_comment_id: string | null;
  published_at: string | null;
  is_owner: boolean;
  can_reply: boolean;
}) {
  return {
    id: row.id,
    media_id: row.post_id,
    post_id: row.post_id,
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
      const post_id = String(item.post_id ?? item.media_id ?? item.id ?? "").trim();
      const comment_count = Number(item.comment_count ?? 0);
      if (!post_id) return null;
      return { post_id, comment_count: Number.isFinite(comment_count) ? comment_count : 0 };
    })
    .filter((row): row is { post_id: string; comment_count: number } => row != null);
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

export async function handleLinkedInComments(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  try {
    const platformForbidden = requireLinkedInContentPlatformConfigured();
    if (platformForbidden) return platformForbidden;

    const action = String(body.action ?? "").trim();
    const organizationId = String(body.organization_id ?? "").trim();
    const pageId = String(body.page_id ?? body.account_id ?? "").trim();
    if (!organizationId) return linkedinContentJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
    if (orgForbidden) return orgForbidden;

    if (action === "getInboxState") {
      if (!pageId) return linkedinContentJson({ error: "Missing page_id" }, 400);
      const state = await getLinkedInManageCommentsInboxState(admin, organizationId, pageId);
      return linkedinContentJson(state, 200);
    }

    if (action === "syncPostBaselines") {
      if (!pageId) return linkedinContentJson({ error: "Missing page_id" }, 400);
      const posts = parsePostBaselines(body);
      const state = await syncLinkedInManageCommentsPostBaselines(admin, organizationId, pageId, posts);
      return linkedinContentJson(state, 200);
    }

    if (action === "syncInboundComments") {
      if (!pageId) return linkedinContentJson({ error: "Missing page_id" }, 400);
      const postId = String(body.post_id ?? body.media_id ?? "").trim();
      if (!postId) return linkedinContentJson({ error: "Missing post_id" }, 400);
      const commentIds = parseCommentIds(body);
      const state = await syncLinkedInManageCommentsInboundComments(
        admin, organizationId, pageId, postId, commentIds,
      );
      return linkedinContentJson(state, 200);
    }

    if (action === "dismissPostHighlight") {
      if (!pageId) return linkedinContentJson({ error: "Missing page_id" }, 400);
      const postId = String(body.post_id ?? body.media_id ?? "").trim();
      if (!postId) return linkedinContentJson({ error: "Missing post_id" }, 400);
      const state = await dismissLinkedInManageCommentsPostHighlight(
        admin, organizationId, pageId, postId,
      );
      return linkedinContentJson(state, 200);
    }

    if (action === "markCommentEngaged") {
      if (!pageId) return linkedinContentJson({ error: "Missing page_id" }, 400);
      const postId = String(body.post_id ?? body.media_id ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!postId || !commentId) {
        return linkedinContentJson({ error: "Missing post_id or comment_id" }, 400);
      }
      const state = await markLinkedInManageCommentsCommentRead(
        admin, organizationId, pageId, postId, commentId, userId,
      );
      return linkedinContentJson({ ok: true, ...state }, 200);
    }

    if (!pageId) return linkedinContentJson({ error: "Missing page_id" }, 400);
    const resolved = await resolveOrgLinkedInContentForMetrics(admin, organizationId, pageId);
    if (!resolved) {
      return linkedinContentJson({ error: "LinkedIn page not connected" }, 404);
    }

    const { accessToken, account } = resolved;
    const resolvedPageId = account.page_id;

    if (action === "sync_posts" || action === "listPosts" || action === "getCommentPosts") {
      const dr = defaultDateRange();
      try {
        const posts = await fetchLinkedInOrganizationPosts(
          accessToken,
          resolvedPageId,
          dr.start,
          dr.end,
        );
        return linkedinContentJson({
          posts: posts.map((p) => ({
            id: String(p.id ?? ""),
            media_id: String(p.id ?? ""),
            post_id: String(p.id ?? ""),
            caption: p.title ?? "",
            title: p.title ?? "",
            thumbnail_url: p.thumbnail_url ?? null,
            cover_image_url: p.thumbnail_url ?? null,
            permalink: p.id ? `https://www.linkedin.com/feed/update/${encodeURIComponent(String(p.id))}/` : null,
            share_url: p.id ? `https://www.linkedin.com/feed/update/${encodeURIComponent(String(p.id))}/` : null,
            timestamp: p.published_at,
            posted_at: p.published_at,
            comment_count: p.comment_count ?? 0,
            like_count: p.like_count ?? 0,
          })),
          page_id: resolvedPageId,
          account_id: account.id,
          account_label: account.label || account.display_name,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return linkedinContentJson({ error: msg, code: "LINKEDIN_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "sync_comments" || action === "listComments") {
      const postId = String(body.post_id ?? body.media_id ?? "").trim();
      if (!postId) return linkedinContentJson({ error: "Missing post_id" }, 400);
      const sort = String(body.sort ?? "newest");
      try {
        const comments = await fetchLinkedInComments(accessToken, postId, resolvedPageId);
        const topLevel = comments.filter((c) => !c.parent_comment_id);
        return linkedinContentJson({
          comments: sortComments(topLevel.map(mapCommentRow), sort),
          page_id: resolvedPageId,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return linkedinContentJson({ error: msg, code: "LINKEDIN_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "listReplies") {
      const postId = String(body.post_id ?? body.media_id ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!postId || !commentId) {
        return linkedinContentJson({ error: "Missing post_id or comment_id" }, 400);
      }
      const sort = String(body.sort ?? "newest");
      try {
        const comments = await fetchLinkedInComments(accessToken, postId, resolvedPageId);
        const replies = comments.filter((c) => c.parent_comment_id === commentId);
        return linkedinContentJson({ comments: sortComments(replies.map(mapCommentRow), sort) }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return linkedinContentJson({ error: msg, code: "LINKEDIN_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "reply" || action === "replyComment") {
      const postId = String(body.post_id ?? body.media_id ?? "").trim();
      const text = String(body.text ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!postId || !text || !commentId) {
        return linkedinContentJson({ error: "Missing post_id, comment_id, or text" }, 400);
      }
      try {
        const reply = await replyLinkedInComment(
          accessToken, postId, resolvedPageId, commentId, text,
        );
        const inboxState = await markLinkedInManageCommentsCommentRead(
          admin, organizationId, resolvedPageId, postId, commentId, userId,
        );
        return linkedinContentJson({
          ok: true,
          comment_id: reply.id,
          ...inboxState,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return linkedinContentJson({ error: msg, code: "LINKEDIN_CONTENT_API_ERROR", action }, 400);
      }
    }

    return linkedinContentJson({ error: "Unknown action", action }, 400);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("linkedin-content-api comments unhandled:", msg);
    return linkedinContentJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
}
