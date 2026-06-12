/// <reference path="../edge-runtime.d.ts" />

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {

  getUserFromBearer,

  requireActiveOrg,

  requireTikTokContentPlatformConfigured,

  tiktokContentCorsHeaders,

  tiktokContentJson,

} from "../_shared/tiktokContentAuth.ts";

import {

  deleteTikTokComment,

  fetchTikTokCommentReplies,

  fetchTikTokVideoComments,

  hideTikTokComment,

  likeTikTokComment,

  replyTikTokComment,

} from "../_shared/tiktokContentApi.ts";

import { pickTikTokAccountLabel } from "../_shared/tiktokContentAccountProfile.ts";
import { resolveOrgTikTokContentForMetrics } from "../_shared/tiktokContentOrgResolver.ts";

import {

  dismissManageCommentsPostHighlight,

  getManageCommentsInboxState,

  markManageCommentsCommentEngaged,

  syncManageCommentsInboundComments,

  syncManageCommentsPostBaselines,

} from "../_shared/tiktokManageCommentsInboxState.ts";



function sortComments<T extends { create_time: number | null }>(

  comments: T[],

  sort: string,

): T[] {

  const copy = [...comments];

  copy.sort((a, b) => {

    const aT = a.create_time ?? 0;

    const bT = b.create_time ?? 0;

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



Deno.serve(async (req: Request) => {

  try {

    if (req.method === "OPTIONS") {

      return new Response("ok", { status: 200, headers: tiktokContentCorsHeaders });

    }

    if (req.method !== "POST") {

      return tiktokContentJson({ error: "Method not allowed" }, 405);

    }



    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {

      return tiktokContentJson({ error: "Server misconfigured" }, 500);

    }



    const platformForbidden = requireTikTokContentPlatformConfigured();

    if (platformForbidden) return platformForbidden;



    const admin = createClient(supabaseUrl, serviceRoleKey);

    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));

    if ("error" in userRes) return userRes.error;



    let body: Record<string, unknown>;

    try {

      body = (await req.json()) as Record<string, unknown>;

    } catch {

      return tiktokContentJson({ error: "Invalid JSON body" }, 400);

    }



    const action = String(body.action ?? "").trim();

    const organizationId = String(body.organization_id ?? "").trim();

    const openId = String(body.open_id ?? "").trim();

    if (!organizationId) return tiktokContentJson({ error: "Missing organization_id" }, 400);



    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);

    if (orgForbidden) return orgForbidden;



    if (action === "getInboxState") {

      if (!openId) return tiktokContentJson({ error: "Missing open_id" }, 400);

      const state = await getManageCommentsInboxState(admin, organizationId, openId);

      return tiktokContentJson(state, 200);

    }



    if (action === "syncPostBaselines") {

      if (!openId) return tiktokContentJson({ error: "Missing open_id" }, 400);

      const posts = parsePostBaselines(body);

      const state = await syncManageCommentsPostBaselines(admin, organizationId, openId, posts);

      return tiktokContentJson(state, 200);

    }



    if (action === "syncInboundComments") {

      if (!openId) return tiktokContentJson({ error: "Missing open_id" }, 400);

      const videoId = String(body.video_id ?? "").trim();

      if (!videoId) return tiktokContentJson({ error: "Missing video_id" }, 400);

      const commentIds = parseCommentIds(body);

      const state = await syncManageCommentsInboundComments(

        admin,

        organizationId,

        openId,

        videoId,

        commentIds,

      );

      return tiktokContentJson(state, 200);

    }



    if (action === "dismissPostHighlight") {

      if (!openId) return tiktokContentJson({ error: "Missing open_id" }, 400);

      const videoId = String(body.video_id ?? "").trim();

      if (!videoId) return tiktokContentJson({ error: "Missing video_id" }, 400);

      const state = await dismissManageCommentsPostHighlight(

        admin,

        organizationId,

        openId,

        videoId,

      );

      return tiktokContentJson(state, 200);

    }



    if (action === "markCommentEngaged") {

      if (!openId) return tiktokContentJson({ error: "Missing open_id" }, 400);

      const videoId = String(body.video_id ?? "").trim();

      const commentId = String(body.comment_id ?? "").trim();

      const engagementType = String(body.engagement_type ?? "like").trim().toLowerCase();

      if (!videoId || !commentId) {

        return tiktokContentJson({ error: "Missing video_id or comment_id" }, 400);

      }

      const state = await markManageCommentsCommentEngaged(

        admin,

        organizationId,

        openId,

        videoId,

        commentId,

        engagementType === "reply"
          ? "reply"
          : engagementType === "delete"
            ? "delete"
            : engagementType === "hide"
              ? "hide"
              : "like",

        userRes.userId,

      );

      return tiktokContentJson({ ok: true, ...state }, 200);

    }



    const resolved = await resolveOrgTikTokContentForMetrics(

      admin,

      organizationId,

      openId || null,

    );

    if (!resolved) {

      return tiktokContentJson({ error: "TikTok account not connected" }, 404);

    }



    const { accessToken, account, tokenKind } = resolved;

    const businessId = account.open_id;



    if (action === "listComments") {

      const videoId = String(body.video_id ?? "").trim();

      if (!videoId) return tiktokContentJson({ error: "Missing video_id" }, 400);

      const cursor = Number(body.cursor ?? 0);

      const sort = String(body.sort ?? "newest");

      const maxCount = Number(body.max_count ?? 30);

      const batch = await fetchTikTokVideoComments(

        accessToken,

        businessId,

        videoId,

        Number.isFinite(cursor) ? cursor : 0,

        Number.isFinite(maxCount) ? maxCount : 30,

        tokenKind,

      );

      return tiktokContentJson({

        comments: sortComments(batch.comments, sort),

        cursor: batch.cursor,

        has_more: batch.has_more,

        open_id: account.open_id,

        account_label: pickTikTokAccountLabel(account),

      }, 200);

    }



    if (action === "listReplies") {

      const commentId = String(body.comment_id ?? "").trim();

      const videoId = String(body.video_id ?? "").trim();

      if (!commentId || !videoId) {

        return tiktokContentJson({ error: "Missing comment_id or video_id" }, 400);

      }

      const cursor = Number(body.cursor ?? 0);

      const sort = String(body.sort ?? "newest");

      const batch = await fetchTikTokCommentReplies(

        accessToken,

        businessId,

        videoId,

        commentId,

        Number.isFinite(cursor) ? cursor : 0,

        30,

        tokenKind,

      );

      return tiktokContentJson({

        comments: sortComments(batch.comments, sort),

        cursor: batch.cursor,

        has_more: batch.has_more,

      }, 200);

    }



    if (action === "replyComment") {

      const videoId = String(body.video_id ?? "").trim();

      const text = String(body.text ?? "").trim();

      const parentCommentId = body.comment_id != null

        ? String(body.comment_id).trim()

        : "";

      if (!videoId || !text) {

        return tiktokContentJson({ error: "Missing video_id or text" }, 400);

      }

      if (!parentCommentId) {

        return tiktokContentJson({ error: "Missing comment_id — click Reply on a comment first" }, 400);

      }

      const result = await replyTikTokComment(accessToken, {

        businessId,

        videoId,

        text,

        commentId: parentCommentId,

      }, tokenKind);

      const inboxState = await markManageCommentsCommentEngaged(

        admin,

        organizationId,

        businessId,

        videoId,

        parentCommentId,

        "reply",

        userRes.userId,

      );

      return tiktokContentJson({

        ok: true,

        comment_id: result.comment_id,

        inbox_state: inboxState,

      }, 200);

    }



    if (action === "hideComment") {

      const commentId = String(body.comment_id ?? "").trim();

      const videoId = String(body.video_id ?? "").trim();

      if (!commentId || !videoId) {

        return tiktokContentJson({ error: "Missing comment_id or video_id" }, 400);

      }

      await hideTikTokComment(accessToken, { businessId, commentId, videoId }, tokenKind);

      const hideState = await markManageCommentsCommentEngaged(
        admin,
        organizationId,
        openId,
        videoId,
        commentId,
        "hide",
        userRes.userId,
      );

      return tiktokContentJson({ ok: true, ...hideState }, 200);

    }



    if (action === "deleteComment") {

      const commentId = String(body.comment_id ?? "").trim();

      const videoId = String(body.video_id ?? "").trim();

      const parentCommentId = String(body.parent_comment_id ?? "").trim();

      if (!commentId || !videoId) {

        return tiktokContentJson({ error: "Missing comment_id or video_id" }, 400);

      }

      await deleteTikTokComment(

        accessToken,

        {
          businessId,
          videoId,
          commentId,
          parentCommentId: parentCommentId || undefined,
        },

        tokenKind,

      );

      const deleteState = await markManageCommentsCommentEngaged(

        admin,

        organizationId,

        openId,

        videoId,

        commentId,

        "delete",

        userRes.userId,

      );

      return tiktokContentJson({ ok: true, ...deleteState }, 200);

    }



    if (action === "likeComment") {

      const commentId = String(body.comment_id ?? "").trim();

      const videoId = String(body.video_id ?? "").trim();

      if (!commentId) {

        return tiktokContentJson({ error: "Missing comment_id" }, 400);

      }

      const likeAction = String(body.like_action ?? "LIKE").trim().toUpperCase();

      await likeTikTokComment(accessToken, {

        businessId,

        commentId,

        action: likeAction === "UNLIKE" ? "UNLIKE" : "LIKE",

      }, tokenKind);



      let inboxState = null;

      if (likeAction !== "UNLIKE" && videoId) {

        inboxState = await markManageCommentsCommentEngaged(

          admin,

          organizationId,

          businessId,

          videoId,

          commentId,

          "like",

          userRes.userId,

        );

      }



      return tiktokContentJson({ ok: true, inbox_state: inboxState }, 200);

    }



    return tiktokContentJson({ error: "Unknown action" }, 400);

  } catch (e) {

    const msg = e instanceof Error ? e.message : "Internal error";

    console.error("tiktok-content-comments:", msg);

    const isTikTokApi = msg.includes("/business/comment/") || msg.includes("TikTok Business API");

    return tiktokContentJson({ error: msg }, isTikTokApi ? 502 : 500);

  }

});

