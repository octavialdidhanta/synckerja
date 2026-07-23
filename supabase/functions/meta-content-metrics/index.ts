/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  averageInstagramViewsLastN,
  buildFacebookMetricsPostRows,
  buildInstagramMetricsPostRows,
  buildMetaContentSummaryFromPosts,
  computeMetaEngagementRate,
  computeInstagramEngagementRateFromApi,
  fetchInstagramMedia,
  fetchMetaAudienceCount,
  META_CONTENT_ALL_TIME_MAX_POSTS,
  META_CONTENT_DATED_MAX_POSTS,
  resolveFacebookPostsForMetrics,
  resolveInstagramPostsForMetrics,
} from "../_shared/metaContentApi.ts";
import {
  backfillLinkMediaIds,
  buildPlanMatchIndex,
  loadMetaPlanLinks,
  loadPlanDetails,
  matchPostToPlan,
} from "../_shared/metaContentPlanMatcher.ts";
import {
  getUserFromBearer,
  metaContentCorsHeaders,
  metaContentJson,
  requireActiveOrg,
  resolveMetaContentAccount,
  type MetaContentPlatform,
} from "../_shared/metaContentAuth.ts";

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

    const action = String(body.action ?? "account_metrics").trim();
    const organizationId = String(body.organization_id ?? "").trim();
    const platform = parsePlatform(body.platform);
    const accountId = String(body.account_id ?? "").trim();
    const dateStart = String(body.date_start ?? body.dateStart ?? "").trim();
    const dateEnd = String(body.date_end ?? body.dateEnd ?? "").trim();
    const allTime = body.all_time === true || String(body.all_time) === "true";

    if (!organizationId) return metaContentJson({ error: "Missing organization_id" }, 400);
    if (!platform) return metaContentJson({ error: "Missing or invalid platform" }, 400);
    if (!accountId) return metaContentJson({ error: "Missing account_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const resolved = await resolveMetaContentAccount(admin, organizationId, platform, accountId);
    if (!resolved) {
      return metaContentJson({ error: "Meta account not connected" }, 404);
    }

    const token = resolved.pageAccessToken;

    if (action === "account_metrics" || action === "accountInsights") {
      try {
        const postDateRange = !allTime && dateStart && dateEnd
          ? { startYmd: dateStart, endYmd: dateEnd }
          : undefined;
        const postLimit = allTime ? META_CONTENT_ALL_TIME_MAX_POSTS : META_CONTENT_DATED_MAX_POSTS;
        const listOptions = allTime ? { allTime: true as const } : undefined;

        const [{ postRows, summary }, audienceCount] = await Promise.all([
          (async () => {
            const posts = platform === "instagram" && resolved.igBusinessAccountId
              ? await resolveInstagramPostsForMetrics(
                resolved.igBusinessAccountId,
                token,
                postLimit,
                postDateRange,
                listOptions,
              )
              : platform === "facebook"
              ? await resolveFacebookPostsForMetrics(
                resolved.pageId,
                token,
                postLimit,
                postDateRange,
                listOptions,
              )
              : [];

            const rows = platform === "facebook"
              ? await buildFacebookMetricsPostRows(posts, token, accountId)
              : await buildInstagramMetricsPostRows(posts, token, accountId);

            const links = await loadMetaPlanLinks(admin, organizationId, platform);
            const matchIndex = buildPlanMatchIndex(links, platform);
            const planIds = [...new Set(links.map((l) => l.social_media_plan_id))];
            const planMap = await loadPlanDetails(admin, planIds);
            const backfillMatches: Array<{ link_id: string; media_id: string }> = [];

            const enrichedRows = rows.map((row) => {
              const match = matchPostToPlan(
                { id: row.content_id, permalink: row.permalink },
                matchIndex,
                planMap,
              );
              if (match.link_id && row.content_id && match.match_type) {
                backfillMatches.push({ link_id: match.link_id, media_id: row.content_id });
              }
              return {
                ...row,
                plan_id: match.plan_id,
                service_name: match.service_name,
                content_pillar: match.content_pillar,
                match_type: match.match_type,
              };
            });

            if (backfillMatches.length > 0) {
              await backfillLinkMediaIds(admin, accountId, backfillMatches);
            }

            return {
              postRows: enrichedRows,
              summary: buildMetaContentSummaryFromPosts(enrichedRows),
            };
          })(),
          fetchMetaAudienceCount(
            platform,
            resolved.igBusinessAccountId,
            resolved.pageId,
            token,
          ),
        ]);

        const totalShares = postRows.reduce((s, r) => s + r.share_count, 0);

        // Instagram Professional Dashboard "Views" = average of last 3 published posts
        // (not the sum of posts inside the date filter).
        let avgViewsLast3: number | null = null;
        let viewsForAccountSummary = summary.views;
        if (platform === "instagram" && resolved.igBusinessAccountId) {
          const viewById = new Map(postRows.map((r) => [r.content_id, r.view_count]));
          const latestThree = await fetchInstagramMedia(resolved.igBusinessAccountId, token, 3);
          const missing = latestThree.filter((p) => !viewById.has(p.id));
          if (missing.length > 0) {
            const missingRows = await buildInstagramMetricsPostRows(missing, token, accountId);
            for (const row of missingRows) viewById.set(row.content_id, row.view_count);
          }
          const last3ForAvg = latestThree.map((p) => ({
            view_count: viewById.get(p.id) ?? 0,
            posted_at: p.timestamp,
          }));
          avgViewsLast3 = averageInstagramViewsLastN(last3ForAvg, 3);
          viewsForAccountSummary = avgViewsLast3;
        }

        return metaContentJson({
          metrics_schema_version: platform === "facebook" ? 7 : 17,
          metrics_mode: platform === "facebook" ? "facebook_dated_posts" : "instagram_dated_posts",
          date_start: dateStart,
          date_end: dateEnd,
          account: {
            platform,
            account_id: accountId,
            account_label: resolved.accountLabel,
            avatar_url: null,
            connected: true,
            audience_count: audienceCount,
            audience_hidden: false,
            audience_label: "followers",
            content_count: postRows.length,
            total_views: viewsForAccountSummary,
            avg_views_last_3: avgViewsLast3,
            views_mode: platform === "instagram" ? "avg_last_3" : "sum",
            total_likes: summary.totalLikes,
            total_comments: summary.totalComments,
            total_shares: totalShares,
            avg_engagement_rate: platform === "instagram"
              ? computeInstagramEngagementRateFromApi(summary.totalInteractions, summary.views)
              : platform === "facebook"
              ? (computeInstagramEngagementRateFromApi(summary.totalInteractions, summary.views)
                ?? computeMetaEngagementRate(
                  summary.totalLikes,
                  summary.totalComments,
                  summary.views,
                  totalShares,
                ))
              : computeMetaEngagementRate(
                summary.totalLikes,
                summary.totalComments,
                summary.views,
                totalShares,
              ),
            reach: summary.reach,
            impressions: viewsForAccountSummary,
            engagement: summary.engagement,
          },
          posts: postRows,
        }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return metaContentJson({ error: msg, code: "META_CONTENT_API_ERROR", action }, 400);
      }
    }

    return metaContentJson({ error: "Unknown action", action }, 400);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("meta-content-metrics unhandled:", msg);
    return metaContentJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
});
