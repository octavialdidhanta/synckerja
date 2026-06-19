/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildFacebookMetricsPostRows,
  buildInstagramMetricsPostRows,
  buildMetaContentSummaryFromPosts,
  computeMetaEngagementRate,
  fetchMetaAudienceCount,
  resolveFacebookPostsForMetrics,
  resolveInstagramPostsForMetrics,
} from "../_shared/metaContentApi.ts";
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
        const postDateRange = dateStart && dateEnd
          ? { startYmd: dateStart, endYmd: dateEnd }
          : undefined;

        const [{ postRows, summary }, audienceCount] = await Promise.all([
          (async () => {
            const posts = platform === "instagram" && resolved.igBusinessAccountId
              ? await resolveInstagramPostsForMetrics(
                resolved.igBusinessAccountId,
                token,
                50,
                postDateRange,
              )
              : platform === "facebook"
              ? await resolveFacebookPostsForMetrics(resolved.pageId, token, 50, postDateRange)
              : [];

            const rows = platform === "facebook"
              ? await buildFacebookMetricsPostRows(posts, token, accountId)
              : await buildInstagramMetricsPostRows(posts, token, accountId);

            return {
              postRows: rows,
              summary: buildMetaContentSummaryFromPosts(rows),
            };
          })(),
          fetchMetaAudienceCount(
            platform,
            resolved.igBusinessAccountId,
            resolved.pageId,
            token,
          ),
        ]);

        return metaContentJson({
          metrics_schema_version: platform === "facebook" ? 6 : 9,
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
            total_views: summary.views,
            total_likes: summary.totalLikes,
            total_comments: summary.totalComments,
            total_shares: 0,
            avg_engagement_rate: computeMetaEngagementRate(
              summary.totalLikes,
              summary.totalComments,
              summary.views,
            ),
            reach: summary.reach,
            impressions: summary.views,
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
