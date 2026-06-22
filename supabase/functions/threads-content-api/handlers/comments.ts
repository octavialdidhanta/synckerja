import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  countThreadTopLevelReplies,
  enrichThreadsPostsWithCommentCounts,
  canThreadsTokenPublishReplies,
  buildThreadsReplyTargetIds,
  buildTopLevelCommentsFromConversation,
  enrichTopLevelReplyCountsFromConversation,
  enrichReplyCountsFromConversation,
  countConversationActivity,
  filterNestedRepliesFromConversation,
  fetchThreadConversation,
  fetchThreadNestedReplies,
  fetchThreadsGrantedPermissions,
  fetchThreadReplies,
  fetchThreadsList,
  replyThreadsComment,
  hideThreadsReply,
  deleteThreadsMedia,
  editThreadsReply,
  canEditThreadsComment,
  type ThreadsComment,
} from "../../_shared/threadsContentApi.ts";
import {
  requireActiveOrg,
  requireThreadsPlatformConfigured,
  resolveOrgThreadsContent,
  threadsContentJson,
} from "../../_shared/threadsContentAuth.ts";
import { missingScopesForFeature } from "../../_shared/metaPlatformScopes.ts";
import { threadsAppId, threadsAppSecret } from "../../_shared/threadsAppCredentials.ts";
import {
  dismissThreadsManageCommentsPostHighlight,
  getThreadsManageCommentsInboxState,
  markThreadsManageCommentsCommentRead,
  syncThreadsManageCommentsInboundComments,
  syncThreadsManageCommentsPostBaselines,
} from "../../_shared/threadsManageCommentsInboxState.ts";
import { parseThreadsPostDateRange } from "../../_shared/threadsContentDateRange.ts";

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
    reply_count: row.reply_count,
    parent_comment_id: row.parent_comment_id,
    published_at: row.published_at,
    is_channel_owner: row.is_owner,
    can_reply: row.can_reply,
    can_edit: canEditThreadsComment(row.published_at, row.is_owner),
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
      const isManageComments = action === "getCommentPosts";
      const dateRange = isManageComments
        ? { isAllTime: true as const, startYmd: null, endYmd: null }
        : parseThreadsPostDateRange(body);
      const listOptions = dateRange.isAllTime
        ? { allTime: true as const }
        : {
          startYmd: dateRange.startYmd!,
          endYmd: dateRange.endYmd!,
        };
      try {
        const posts = await fetchThreadsList(accessToken, isManageComments ? 100 : 50, listOptions);
        const withCounts = isManageComments
          ? await enrichThreadsPostsWithCommentCounts(posts, accessToken)
          : posts;
        if (isManageComments) {
          const inboxState = await syncThreadsManageCommentsPostBaselines(
            admin,
            organizationId,
            resolvedThreadsUserId,
            withCounts.map((p) => ({ media_id: p.id, comment_count: p.comment_count ?? 0 })),
          );
          return threadsContentJson({
            posts: withCounts.map((p) => ({
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
          inbox: inboxState,
        }, 200);
        }
        return threadsContentJson({
          posts: withCounts.map((p) => ({
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
      const emptyCommentsPayload = {
        comments: [] as ReturnType<typeof mapCommentRow>[],
        comment_count: 0,
        activity_count: 0,
        threads_user_id: resolvedThreadsUserId,
        account_id: resolvedAccountId,
      };
      try {
        const conversation = await fetchThreadConversation(mediaId, accessToken);
        const topLevel = buildTopLevelCommentsFromConversation(conversation, mediaId);
        const withReplyCounts = enrichTopLevelReplyCountsFromConversation(topLevel, conversation);
        const commentCount = withReplyCounts.length;
        const activityCount = countConversationActivity(conversation, mediaId);
        try {
          await syncThreadsManageCommentsPostBaselines(admin, organizationId, resolvedThreadsUserId, [
            { media_id: mediaId, comment_count: commentCount },
          ]);
        } catch (syncErr) {
          console.warn("listComments inbox sync skipped:", mediaId, syncErr);
        }
        return threadsContentJson({
          comments: sortComments(withReplyCounts.map(mapCommentRow), sort),
          comment_count: commentCount,
          activity_count: activityCount,
          threads_user_id: resolvedThreadsUserId,
          account_id: resolvedAccountId,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (
          /does not exist|unsupported get request|nonexisting|\(#100\)/i.test(msg) ||
          /missing permissions|\(#10\)|\(#200\)/i.test(msg)
        ) {
          return threadsContentJson(emptyCommentsPayload, 200);
        }
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
        const conversation = await fetchThreadConversation(mediaId, accessToken);
        const replies = filterNestedRepliesFromConversation(conversation, commentId);
        const withCounts = enrichReplyCountsFromConversation(replies, conversation);
        return threadsContentJson({ comments: sortComments(withCounts.map(mapCommentRow), sort) }, 200);
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

      const appId = threadsAppId();
      const appSecret = threadsAppSecret();
      const liveScopes = await fetchThreadsGrantedPermissions(accessToken, appId, appSecret);
      const scopesToCheck = liveScopes.length > 0 ? liveScopes : account.grantedScopes;
      const hasManageReplies = scopesToCheck.some((s) => s.toLowerCase() === "threads_manage_replies");
      const hasContentPublish = scopesToCheck.some((s) => s.toLowerCase() === "threads_content_publish");

      if (!hasContentPublish) {
        return threadsContentJson({
          error: "threads_content_publish is not granted on your Threads OAuth token. Reading comments works, but publishing replies requires this scope. Revoke Synckerja under Threads → Settings → Website permissions, then reconnect and accept the publish content permission.",
          code: "THREADS_MISSING_CONTENT_PUBLISH",
          missing_scopes: ["threads_content_publish"],
          granted_scopes: scopesToCheck,
          has_manage_replies: hasManageReplies,
          has_content_publish: false,
          threads_app_id: appId || null,
          action,
        }, 403);
      }

      const missingFromDebug = missingScopesForFeature(scopesToCheck, "threads_replies");
      const canPublishReplies = await canThreadsTokenPublishReplies(resolvedThreadsUserId, accessToken);
      if (missingFromDebug.length > 0 && !canPublishReplies) {
        return threadsContentJson({
          error: `Missing Threads permissions: ${missingFromDebug.join(", ")}. Token scopes: [${scopesToCheck.join(", ") || "unknown"}]. Reply needs threads_manage_replies + threads_content_publish. Verify Meta App ID ${appId || "?"} matches your Threads API app, revoke Synckerja under Threads → Website permissions, then reconnect and accept all permissions.`,
          code: "THREADS_MISSING_SCOPES",
          missing_scopes: missingFromDebug,
          granted_scopes: scopesToCheck,
          has_manage_replies: hasManageReplies,
          has_content_publish: hasContentPublish,
          can_publish_replies: false,
          threads_app_id: appId || null,
          action,
        }, 403);
      }

      try {
        const reply = await replyThreadsComment(
          mediaId,
          text,
          accessToken,
          commentId || undefined,
          resolvedThreadsUserId,
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
        const liveScopesOnError = await fetchThreadsGrantedPermissions(accessToken, appId, appSecret);
        const scopesForError = liveScopesOnError.length > 0 ? liveScopesOnError : scopesToCheck;
        const replyTargetIds = await buildThreadsReplyTargetIds(
          mediaId,
          commentId || undefined,
          accessToken,
        ).catch(() => [] as string[]);
        return threadsContentJson({
          error: msg,
          code: "THREADS_CONTENT_API_ERROR",
          action,
          media_id: mediaId,
          comment_id: commentId || null,
          reply_target_ids: replyTargetIds,
          granted_scopes: scopesForError,
          has_manage_replies: scopesForError.some((s) => s.toLowerCase() === "threads_manage_replies"),
          has_content_publish: scopesForError.some((s) => s.toLowerCase() === "threads_content_publish"),
          threads_app_id: appId || null,
        }, 400);
      }
    }

    if (action === "hideComment") {
      const commentId = String(body.comment_id ?? "").trim();
      if (!commentId) return threadsContentJson({ error: "Missing comment_id" }, 400);
      const hide = String(body.hide ?? "true").trim().toLowerCase() !== "false";
      try {
        await hideThreadsReply(commentId, accessToken, hide);
        return threadsContentJson({ ok: true }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return threadsContentJson({ error: msg, code: "THREADS_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "deleteComment") {
      const commentId = String(body.comment_id ?? "").trim();
      const mediaId = String(body.media_id ?? body.post_id ?? "").trim();
      if (!commentId) return threadsContentJson({ error: "Missing comment_id" }, 400);
      const scopesToCheck = account.grantedScopes;
      if (!scopesToCheck.some((s) => s.toLowerCase() === "threads_delete")) {
        return threadsContentJson({
          error: "threads_delete is not granted. Reconnect Threads and accept delete permission.",
          code: "THREADS_MISSING_DELETE",
          missing_scopes: ["threads_delete"],
        }, 403);
      }
      try {
        await deleteThreadsMedia(commentId, accessToken);
        const inboxState = mediaId
          ? await getThreadsManageCommentsInboxState(admin, organizationId, resolvedThreadsUserId)
          : undefined;
        return threadsContentJson({ ok: true, ...(inboxState ?? {}) }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return threadsContentJson({ error: msg, code: "THREADS_CONTENT_API_ERROR", action }, 400);
      }
    }

    if (action === "editComment") {
      const mediaId = String(body.media_id ?? body.post_id ?? "").trim();
      const commentId = String(body.comment_id ?? "").trim();
      const parentCommentId = String(body.parent_comment_id ?? body.reply_to_id ?? "").trim();
      const text = String(body.text ?? "").trim();
      if (!mediaId || !commentId || !parentCommentId || !text) {
        return threadsContentJson({ error: "Missing media_id, comment_id, parent_comment_id, or text" }, 400);
      }
      const publishedAt = String(body.published_at ?? "").trim() || null;
      const isOwner = body.is_channel_owner === true;
      try {
        const edited = await editThreadsReply({
          postMediaId: mediaId,
          replyId: commentId,
          parentCommentId,
          text,
          accessToken,
          threadsUserId: resolvedThreadsUserId,
          publishedAt,
          isOwner,
        });
        return threadsContentJson({ ok: true, comment_id: edited.id }, 200);
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
