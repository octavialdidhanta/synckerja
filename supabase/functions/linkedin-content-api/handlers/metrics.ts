import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  requireActiveOrg,
  requireLinkedInContentPlatformConfigured,
  linkedinContentJson,
} from "../../_shared/linkedinContentAuth.ts";
import {
  buildLinkedInPostUrl,
  fetchLinkedInOrganizationPosts,
} from "../../_shared/linkedinContentApi.ts";
import { resolveOrgLinkedInContentForMetrics } from "../../_shared/linkedinContentOrgResolver.ts";
import {
  backfillLinkPostIds,
  buildPlanMatchIndex,
  computeEngagementRate,
  loadPlanDetails,
  loadLinkedInPlanLinks,
  matchPostToPlan,
} from "../../_shared/linkedinContentPlanMatcher.ts";

const CACHE_TTL_MINUTES = 15;
const METRICS_CACHE_KEY = "post-list-v1";
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

export async function handleLinkedInMetrics(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  try {
    const platformForbidden = requireLinkedInContentPlatformConfigured();
    if (platformForbidden) return platformForbidden;

    const organizationId = String(body.organization_id ?? "").trim();
    if (!organizationId) return linkedinContentJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const dr = defaultDateRange();
    const rawStart = String(body.date_start ?? dr.start).trim();
    const rawEnd = String(body.date_end ?? dr.end).trim();
    const { start: dateStart, end: dateEnd } = clampDateRange(rawStart, rawEnd);
    const pageIdParam = body.page_id != null ? String(body.page_id).trim() : null;
    const forceRefresh = body.force_refresh === true;
    const now = new Date();

    const resolved = await resolveOrgLinkedInContentForMetrics(admin, organizationId, pageIdParam);
    if (!resolved) {
      return linkedinContentJson({ error: "LinkedIn Content not connected or no page configured" }, 400);
    }

    const { accessToken, account } = resolved;
    const pageId = account.page_id;

    if (!forceRefresh) {
      const { data: cached } = await admin
        .from("linkedin_content_metrics_cache")
        .select("response_json, fetched_at")
        .eq("organization_id", organizationId)
        .eq("page_id", pageId)
        .eq("date_start", dateStart)
        .eq("date_end", dateEnd)
        .eq("metrics_key", METRICS_CACHE_KEY)
        .eq("page_token", "")
        .gt("expires_at", now.toISOString())
        .maybeSingle();
      if (cached?.response_json) {
        return linkedinContentJson({ ...(cached.response_json as object), cached: true }, 200);
      }
    }

    let posts;
    try {
      posts = await fetchLinkedInOrganizationPosts(
        accessToken,
        pageId,
        dateStart,
        dateEnd,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("linkedin-content-api getMetrics fetchPosts:", msg);
      return linkedinContentJson({ error: msg, code: "LINKEDIN_CONTENT_API_ERROR" }, 400);
    }

    const links = await loadLinkedInPlanLinks(admin, organizationId);
    const matchIndex = buildPlanMatchIndex(links);
    const planIds = [...new Set(links.map((l) => l.social_media_plan_id))];
    const planMap = await loadPlanDetails(admin, planIds);

    const backfillMatches: Array<{ link_id: string; post_id: string }> = [];
    const rows = posts.map((post) => {
      const match = matchPostToPlan(post, matchIndex, planMap);
      const postId = String(post.id ?? "").trim();
      if (match.link_id && postId && match.match_type) {
        backfillMatches.push({ link_id: match.link_id, post_id: postId });
      }
      const engagementRate = computeEngagementRate(post);
      const postedAt = post.published_at ? new Date(post.published_at).toISOString() : null;

      return {
        post_id: postId,
        title: post.title ?? "",
        share_url: postId ? buildLinkedInPostUrl(postId) : null,
        cover_image_url: post.thumbnail_url ?? null,
        duration: null,
        view_count: post.view_count ?? 0,
        like_count: post.like_count ?? 0,
        comment_count: post.comment_count ?? 0,
        share_count: post.share_count ?? 0,
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
      await backfillLinkPostIds(admin, organizationId, pageId, backfillMatches);
    }

    const summary = {
      post_count: rows.length,
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
      page_id: pageId,
      account_id: account.id,
      account_label: account.label || account.display_name,
      date_start: dateStart,
      date_end: dateEnd,
      fetched_at: now.toISOString(),
    };

    const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60_000).toISOString();
    await admin.from("linkedin_content_metrics_cache").upsert({
      organization_id: organizationId,
      page_id: pageId,
      date_start: dateStart,
      date_end: dateEnd,
      metrics_key: METRICS_CACHE_KEY,
      page_token: "",
      response_json: payload,
      fetched_at: now.toISOString(),
      expires_at: expiresAt,
    }, {
      onConflict: "organization_id,page_id,date_start,date_end,metrics_key,page_token",
    });

    return linkedinContentJson(payload, 200);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("linkedin-content-api getMetrics unhandled:", msg);
    return linkedinContentJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
}
