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
import { fetchAllTikTokVideosInRange } from "../_shared/tiktokContentApi.ts";
import { resolveOrgTikTokContentForMetrics } from "../_shared/tiktokContentOrgResolver.ts";
import {
  backfillLinkVideoIds,
  buildPlanMatchIndex,
  computeEngagementRate,
  loadPlanDetails,
  loadTikTokPlanLinks,
  matchVideoToPlan,
} from "../_shared/tiktokContentPlanMatcher.ts";

const CACHE_TTL_MINUTES = 15;
const METRICS_CACHE_KEY = "video-list-v1";
const MAX_LOOKBACK_DAYS = 365;

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampDateRange(startYmd: string, endYmd: string, now = new Date()) {
  const minStart = new Date(now);
  minStart.setDate(minStart.getDate() - MAX_LOOKBACK_DAYS);
  let start = parseYmd(startYmd) ?? minStart;
  let end = parseYmd(endYmd) ?? now;
  if (start.getTime() < minStart.getTime()) start = minStart;
  if (start.getTime() > end.getTime()) start = end;
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
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

    const organizationId = String(body.organization_id ?? "").trim();
    if (!organizationId) return tiktokContentJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const dr = defaultDateRange();
    const rawStart = String(body.date_start ?? dr.start).trim();
    const rawEnd = String(body.date_end ?? dr.end).trim();
    const { start: dateStart, end: dateEnd } = clampDateRange(rawStart, rawEnd);
    const openIdParam = body.open_id != null ? String(body.open_id).trim() : null;
    const forceRefresh = body.force_refresh === true;
    const now = new Date();

    const resolved = await resolveOrgTikTokContentForMetrics(admin, organizationId, openIdParam);
    if (!resolved) {
      return tiktokContentJson({ error: "TikTok Content not connected or no account configured" }, 400);
    }

    const { accessToken, account } = resolved;
    const openId = account.open_id;

    if (!forceRefresh) {
      const { data: cached } = await admin
        .from("tiktok_content_metrics_cache")
        .select("response_json, fetched_at")
        .eq("organization_id", organizationId)
        .eq("open_id", openId)
        .eq("date_start", dateStart)
        .eq("date_end", dateEnd)
        .eq("metrics_key", METRICS_CACHE_KEY)
        .eq("page_token", "")
        .gt("expires_at", now.toISOString())
        .maybeSingle();
      if (cached?.response_json) {
        return tiktokContentJson({ ...(cached.response_json as object), cached: true }, 200);
      }
    }

    let videos;
    try {
      videos = await fetchAllTikTokVideosInRange(accessToken, dateStart, dateEnd);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("tiktok-content-metrics fetchVideos:", msg);
      return tiktokContentJson({ error: msg, code: "TIKTOK_CONTENT_API_ERROR" }, 400);
    }

    const links = await loadTikTokPlanLinks(admin, organizationId);
    const matchIndex = buildPlanMatchIndex(links);
    const planIds = [...new Set(links.map((l) => l.social_media_plan_id))];
    const planMap = await loadPlanDetails(admin, planIds);

    const backfillMatches: Array<{ link_id: string; video_id: string }> = [];
    const rows = videos.map((video) => {
      const match = matchVideoToPlan(video, matchIndex, planMap);
      const videoId = String(video.id ?? "").trim();
      if (match.link_id && videoId && match.match_type) {
        backfillMatches.push({ link_id: match.link_id, video_id: videoId });
      }
      const engagementRate = computeEngagementRate(video);
      const createTime = Number(video.create_time ?? 0);
      const postedAt = Number.isFinite(createTime) && createTime > 0
        ? new Date(createTime * 1000).toISOString()
        : null;

      return {
        video_id: videoId,
        title: video.title ?? video.video_description ?? "",
        share_url: video.share_url ?? null,
        cover_image_url: video.cover_image_url ?? null,
        duration: video.duration ?? null,
        view_count: video.view_count ?? 0,
        like_count: video.like_count ?? 0,
        comment_count: video.comment_count ?? 0,
        share_count: video.share_count ?? 0,
        engagement_rate: engagementRate,
        posted_at: postedAt,
        plan_id: match.plan_id,
        service_name: match.service_name,
        content_pillar: match.content_pillar,
        pic_name: match.pic_name,
        plan_post_date: match.actual_post_date,
        match_type: match.match_type,
      };
    });

    if (backfillMatches.length > 0) {
      await backfillLinkVideoIds(admin, organizationId, openId, backfillMatches);
    }

    const summary = {
      video_count: rows.length,
      total_views: rows.reduce((s, r) => s + (Number(r.view_count) || 0), 0),
      total_likes: rows.reduce((s, r) => s + (Number(r.like_count) || 0), 0),
      total_comments: rows.reduce((s, r) => s + (Number(r.comment_count) || 0), 0),
      total_shares: rows.reduce((s, r) => s + (Number(r.share_count) || 0), 0),
      avg_engagement_rate: rows.length > 0
        ? rows.reduce((s, r) => s + (Number(r.engagement_rate) || 0), 0) / rows.length
        : null,
      matched_plans: rows.filter((r) => r.plan_id).length,
    };

    const payload = {
      rows,
      summary,
      open_id: openId,
      account_id: account.id,
      account_label: account.label || account.display_name,
      date_start: dateStart,
      date_end: dateEnd,
      fetched_at: now.toISOString(),
    };

    const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60_000).toISOString();
    await admin.from("tiktok_content_metrics_cache").upsert({
      organization_id: organizationId,
      open_id: openId,
      date_start: dateStart,
      date_end: dateEnd,
      metrics_key: METRICS_CACHE_KEY,
      page_token: "",
      response_json: payload,
      fetched_at: now.toISOString(),
      expires_at: expiresAt,
    }, {
      onConflict: "organization_id,open_id,date_start,date_end,metrics_key,page_token",
    });

    return tiktokContentJson(payload, 200);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("tiktok-content-metrics unhandled:", msg);
    return tiktokContentJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
});
