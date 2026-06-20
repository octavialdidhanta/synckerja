import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildThreadsMetricsPostRows,
  buildThreadsSummaryFromPosts,
  computeThreadsEngagementRate,
  fetchThreadsFollowerCount,
  fetchThreadsList,
} from "../../_shared/threadsContentApi.ts";
import {
  requireActiveOrg,
  requireThreadsPlatformConfigured,
  resolveOrgThreadsContent,
  threadsContentJson,
} from "../../_shared/threadsContentAuth.ts";
import {
  parseThreadsPostDateRange,
  THREADS_ALL_TIME_START_YMD,
} from "../../_shared/threadsContentDateRange.ts";

export async function handleThreadsMetrics(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  try {
    const platformForbidden = requireThreadsPlatformConfigured();
    if (platformForbidden) return platformForbidden;

    const organizationId = String(body.organization_id ?? "").trim();
    if (!organizationId) return threadsContentJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const now = new Date();

    function formatDateYmd(d: Date): string {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    const dateRange = parseThreadsPostDateRange(body, now);
    const dateStart = dateRange.isAllTime
      ? THREADS_ALL_TIME_START_YMD
      : (dateRange.startYmd ?? THREADS_ALL_TIME_START_YMD);
    const dateEnd = dateRange.isAllTime
      ? formatDateYmd(now)
      : (dateRange.endYmd ?? formatDateYmd(now));
    const accountIdParam = body.account_id != null ? String(body.account_id).trim() : null;

    const resolved = await resolveOrgThreadsContent(admin, organizationId, accountIdParam);
    if (!resolved) {
      return threadsContentJson({ error: "Threads not connected for this organization" }, 400);
    }

    const { accessToken, account } = resolved;
    const accountId = account.instagramBusinessAccountId || account.threadsUserId;

    let posts;
    let audienceCount: number | null = null;
    try {
      [posts, audienceCount] = await Promise.all([
        fetchThreadsList(accessToken, 50, dateRange.isAllTime
          ? { allTime: true }
          : { startYmd: dateStart, endYmd: dateEnd }),
        fetchThreadsFollowerCount(accessToken),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("threads-content-api getMetrics fetch:", msg);
      return threadsContentJson({ error: msg, code: "THREADS_CONTENT_API_ERROR" }, 400);
    }

    const postRows = await buildThreadsMetricsPostRows(posts, accessToken, accountId);
    const summary = buildThreadsSummaryFromPosts(postRows);

    const payload = {
      metrics_schema_version: 1,
      metrics_mode: "threads_dated_posts",
      date_start: dateStart,
      date_end: dateEnd,
      account: {
        platform: "threads",
        account_id: accountId,
        threads_user_id: account.threadsUserId,
        account_label: account.accountLabel,
        avatar_url: account.threadsProfilePictureUrl,
        connected: true,
        audience_count: audienceCount,
        audience_hidden: false,
        audience_label: "followers",
        content_count: postRows.length,
        total_views: summary.views,
        total_likes: summary.totalLikes,
        total_comments: summary.totalComments,
        total_shares: postRows.reduce((s, r) => s + r.share_count, 0),
        avg_engagement_rate: computeThreadsEngagementRate(
          summary.totalLikes,
          summary.totalComments,
          summary.views,
        ),
        reach: summary.reach,
        impressions: summary.views,
        engagement: summary.engagement,
      },
      posts: postRows,
      fetched_at: now.toISOString(),
    };

    return threadsContentJson(payload, 200);
  } catch (unhandled) {
    const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
    console.error("threads-content-api getMetrics unhandled:", msg);
    return threadsContentJson({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
}
