/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireYouTubeContentPlatformConfigured,
  youtubeContentCorsHeaders,
  youtubeContentJson,
} from "../_shared/youtubeContentAuth.ts";
import {
  fetchYouTubeChannelAnalyticsBundle,
  YouTubeAnalyticsForbiddenError,
} from "../_shared/youtubeChannelAnalyticsApi.ts";
import { resolveOrgYouTubeContentForMetrics } from "../_shared/youtubeContentOrgResolver.ts";

const CACHE_TTL_MINUTES = 15;
const CHANNEL_ANALYTICS_CACHE_KEY = "channel-analytics-v2";
const YOUTUBE_ANALYTICS_EARLIEST_YMD = "2012-01-01";

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
  const minStart = parseYmd(YOUTUBE_ANALYTICS_EARLIEST_YMD) ?? new Date(now);
  let start = parseYmd(startYmd) ?? minStart;
  let end = parseYmd(endYmd) ?? now;
  if (start.getTime() < minStart.getTime()) start = minStart;
  if (start.getTime() > end.getTime()) start = end;
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
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

    const organizationId = String(body.organization_id ?? "").trim();
    if (!organizationId) return youtubeContentJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const now = new Date();
    const dr = defaultDateRange();
    const rawStart = String(body.date_start ?? dr.start).trim();
    const rawEnd = String(body.date_end ?? dr.end).trim();
    const { start: dateStart, end: dateEnd } = clampDateRange(rawStart, rawEnd, now);
    const channelIdParam = body.channel_id != null ? String(body.channel_id).trim() : null;
    const forceRefresh = body.force_refresh === true;

    const resolved = await resolveOrgYouTubeContentForMetrics(admin, organizationId, channelIdParam);
    if (!resolved) {
      return youtubeContentJson({ error: "YouTube Content not connected or no channel configured" }, 400);
    }

    const { accessToken, account } = resolved;
    const channelId = account.channel_id;

    if (!forceRefresh) {
      const { data: cached } = await admin
        .from("youtube_content_metrics_cache")
        .select("response_json, fetched_at")
        .eq("organization_id", organizationId)
        .eq("channel_id", channelId)
        .eq("date_start", dateStart)
        .eq("date_end", dateEnd)
        .eq("metrics_key", CHANNEL_ANALYTICS_CACHE_KEY)
        .eq("page_token", "")
        .gt("expires_at", now.toISOString())
        .maybeSingle();
      if (cached?.response_json) {
        return youtubeContentJson({ ...(cached.response_json as object), cached: true }, 200);
      }
    }

    let bundle;
    try {
      bundle = await fetchYouTubeChannelAnalyticsBundle(
        accessToken,
        channelId,
        dateStart,
        dateEnd,
      );
    } catch (e) {
      if (e instanceof YouTubeAnalyticsForbiddenError) {
        return youtubeContentJson({
          error: e.message,
          code: "YOUTUBE_ANALYTICS_FORBIDDEN",
        }, 400);
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.error("youtube-content-channel-analytics fetch:", msg);
      return youtubeContentJson({ error: msg, code: "YOUTUBE_CONTENT_API_ERROR" }, 400);
    }

    const payload = {
      channel_id: channelId,
      account_id: account.id,
      account_label: account.label || account.display_name,
      date_start: dateStart,
      date_end: dateEnd,
      overview: bundle.overview,
      demographics: bundle.demographics,
      traffic_sources: bundle.traffic_sources,
      daily_trend: bundle.daily_trend,
      fetched_at: now.toISOString(),
    };

    const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60_000).toISOString();
    await admin.from("youtube_content_metrics_cache").upsert({
      organization_id: organizationId,
      channel_id: channelId,
      date_start: dateStart,
      date_end: dateEnd,
      metrics_key: CHANNEL_ANALYTICS_CACHE_KEY,
      page_token: "",
      response_json: payload,
      fetched_at: now.toISOString(),
      expires_at: expiresAt,
    }, {
      onConflict: "organization_id,channel_id,date_start,date_end,metrics_key,page_token",
    });

    return youtubeContentJson(payload, 200);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("youtube-content-channel-analytics unhandled:", msg);
    return youtubeContentJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
});
