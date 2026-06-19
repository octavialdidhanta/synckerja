/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchMetaComments,
  fetchMetaPosts,
  replyMetaComment,
  type MetaContentComment,
} from "../_shared/metaContentApi.ts";
import {
  getUserFromBearer,
  metaContentCorsHeaders,
  metaContentJson,
  requireActiveOrg,
  resolveMetaContentAccount,
  type MetaContentPlatform,
} from "../_shared/metaContentAuth.ts";
import {
  dismissMetaManageCommentsPostHighlight,
  getMetaManageCommentsInboxState,
  markMetaManageCommentsCommentRead,
  syncMetaManageCommentsInboundComments,
  syncMetaManageCommentsPostBaselines,
} from "../_shared/metaManageCommentsInboxState.ts";

function sortComments<T extends { published_at: string | null }>(comments: T[], sort: string): T[] {
  const copy = [...comments];
  copy.sort((a, b) => {
    const aT = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bT = b.published_at ? new Date(b.published_at).getTime() : 0;
    return sort === "oldest" ? aT - bT : bT - aT;
  });
  return copy;
}

function mapCommentRow(row: MetaContentComment) {
  return {
    id: row.id,
    media_id: row.media_id,
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
      const media_id = String(item.media_id ?? item.id ?? "").trim();
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

function parsePlatform(raw: unknown): MetaContentPlatform | null {
  const p = String(raw ?? "").trim().toLowerCase();
  if (p === "instagram" || p === "facebook") return p;
  return null;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: metaContentCorsHeaders });
    }
    if (req.method !== "POST") {
      return metaContentJson({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return metaContentJson({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return metaContentJson({ error: "Invalid JSON body" }, 400);
    }

    const action = String(body.action ?? "").trim();
    const organizationId = String(body.organization_id ?? "").trim();
    const platform = parsePlatform(body.platform);
    const accountId = String(body.account_id ?? "").trim();
    if (!organizationId) return metaContentJson({ error: "Missing organization_id" }, 400);
    if (!platform) return metaContentJson({ error: "Missing or invalid platform" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    if (action === "getInboxState") {
      if (!accountId) return metaContentJson({ error: "Missing account_id" }, 400);
      const state = await getMetaManageCommentsInboxState(admin, organizationId, platform, accountId);
      return metaContentJson(state, 200);
    }

    if (action === "syncPostBaselines") {
      if (!accountId) return metaContentJson({ error: "Missing account_id" }, 400);
      const posts = parsePostBaselines(body);
      const state = await syncMetaManageCommentsPostBaselines(admin, organizationId, platform, accountId, posts);
      return metaContentJson(state, 200);
    }

    if (action === "syncInboundComments") {
      if (!accountId) return metaContentJson({ error: "Missing account_id" }, 400);
      const mediaId = String(body.media_id ?? "").trim();
      if (!mediaId) return metaContentJson({ error: "Missing media_id" }, 400);
      const commentIds = parseCommentIds(body);
      const state = await syncMetaManageCommentsInboundComments(
        admin, organizationId, platform, accountId, mediaId, commentIds,
      );
      return metaContentJson(state, 200);
    }

    if (action === "dismissPostHighlight") {
      if (!accountId) return metaContentJson({ error: "Missing account_id" }, 400);
      const mediaId = String(body.media_id ?? "").trim();
      if (!mediaId) return metaContentJson({ error: "Missing media_id" }, 400);
      const state = await dismissMetaManageCommentsPostHighlight(
        admin, organizationId, platform, accountId, mediaId,
      );
      return metaContentJson(state, 200);
    }

    if (action === "markCommentEngaged") {
      if (!accountId) return metaContentJson({ error: "Missing account_id" }, 400);
      const mediaId = String(body.media_id ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!mediaId || !commentId) {
        return metaContentJson({ error: "Missing media_id or comment_id" }, 400);
      }
      const state = await markMetaManageCommentsCommentRead(
        admin, organizationId, platform, accountId, mediaId, commentId, userRes.userId,
      );
      return metaContentJson({ ok: true, ...state }, 200);
    }

    if (!accountId) return metaContentJson({ error: "Missing account_id" }, 400);
    const resolved = await resolveMetaContentAccount(admin, organizationId, platform, accountId);
    if (!resolved) {
      return metaContentJson({ error: "Meta account not connected" }, 404);
    }

    const token = resolved.pageAccessToken;

    if (action === "sync_posts" || action === "listPosts") {
      try {
        const posts = await fetchMetaPosts(platform, {
          pageId: resolved.pageId,
          igBusinessAccountId: resolved.igBusinessAccountId,
          pageAccessToken: token,
        });
        return metaContentJson({
          posts: posts.map((p) => ({
            id: p.id,
            media_id: p.id,
            caption: p.caption,
            media_type: p.media_type,
            media_url: p.media_url,
            thumbnail_url: p.thumbnail_url,
            permalink: p.permalink,
            timestamp: p.timestamp,
            comment_count: p.comment_count,
            like_count: p.like_count,
          })),
          account_id: accountId,
          account_label: resolved.accountLabel,
          platform,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return metaContentJson({ error: msg, code: "META_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "sync_comments" || action === "listComments") {
      const mediaId = String(body.media_id ?? "").trim();
      if (!mediaId) return metaContentJson({ error: "Missing media_id" }, 400);
      const sort = String(body.sort ?? "newest");
      try {
        const comments = await fetchMetaComments(platform, mediaId, token);
        const topLevel = comments.filter((c) => !c.parent_comment_id);
        return metaContentJson({
          comments: sortComments(topLevel.map(mapCommentRow), sort),
          account_id: accountId,
          platform,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return metaContentJson({ error: msg, code: "META_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "listReplies") {
      const mediaId = String(body.media_id ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!mediaId || !commentId) {
        return metaContentJson({ error: "Missing media_id or comment_id" }, 400);
      }
      const sort = String(body.sort ?? "newest");
      try {
        const comments = await fetchMetaComments(platform, mediaId, token);
        const replies = comments.filter((c) => c.parent_comment_id === commentId);
        return metaContentJson({ comments: sortComments(replies.map(mapCommentRow), sort) }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return metaContentJson({ error: msg, code: "META_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "reply" || action === "replyComment") {
      const mediaId = String(body.media_id ?? "").trim();
      const text = String(body.text ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      if (!mediaId || !text || !commentId) {
        return metaContentJson({ error: "Missing media_id, comment_id, or text" }, 400);
      }
      try {
        const reply = await replyMetaComment(platform, commentId, text, token);
        const inboxState = await markMetaManageCommentsCommentRead(
          admin, organizationId, platform, accountId, mediaId, commentId, userRes.userId,
        );
        return metaContentJson({
          ok: true,
          comment_id: reply.id,
          ...inboxState,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return metaContentJson({ error: msg, code: "META_CONTENT_API_ERROR", action }, 400);
      }
    }

    return metaContentJson({ error: "Unknown action", action }, 400);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("meta-content-comments unhandled:", msg);
    return metaContentJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
});
