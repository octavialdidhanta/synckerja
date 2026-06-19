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

    const dr = defaultDateRange();
    const rawStart = String(body.date_start ?? dr.start).trim();
    const rawEnd = String(body.date_end ?? dr.end).trim();
    const { start: dateStart, end: dateEnd } = clampDateRange(rawStart, rawEnd);
    const accountIdParam = body.account_id != null ? String(body.account_id).trim() : null;
    const now = new Date();

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
        fetchThreadsList(accessToken, 50, { startYmd: dateStart, endYmd: dateEnd }),
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
