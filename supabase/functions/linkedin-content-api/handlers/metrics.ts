import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  missingLinkedInScopesForFeature,
  parseLinkedInGrantedScopes,
  requireActiveOrg,
  requireLinkedInContentPlatformConfigured,
  linkedinContentJson,
} from "../../_shared/linkedinContentAuth.ts";
import {
  buildLinkedInPostUrl,
  fetchLinkedInFollowerCount,
  fetchLinkedInMemberPosts,
  fetchLinkedInOrganizationPosts,
  fetchMemberCreatorPostAnalytics,
  fetchShareImpressionCounts,
} from "../../_shared/linkedinContentApi.ts";
import {
  getLinkedInContentAccessToken,
  isLinkedInPersonAccount,
  resolveLinkedInContentForMetrics,
} from "../../_shared/linkedinContentOrgResolver.ts";
import {
  isLinkedInContentAuthFailure,
  linkedInContentReauthErrorMessage,
} from "../../_shared/linkedinContentAuthError.ts";
import {
  backfillLinkPostIds,
  buildPlanMatchIndex,
  computeEngagementRate,
  loadPlanDetails,
  loadLinkedInPlanLinks,
  matchPostToPlan,
  parseLinkedInPostIdFromUrl,
} from "../../_shared/linkedinContentPlanMatcher.ts";

const CACHE_TTL_MINUTES = 15;
const METRICS_CACHE_KEY = "post-list-v2"; // v2: impressionCount → view_count
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

    const resolved = await resolveLinkedInContentForMetrics(admin, organizationId, pageIdParam, {
      allowPerson: true,
    });
    if (!resolved) {
      return linkedinContentJson({ error: "LinkedIn Content not connected or no page configured" }, 400);
    }

    const { accessToken, account } = resolved;
    const pageId = account.page_id;
    const isPerson = isLinkedInPersonAccount(account);

    if (isPerson) {
      const granted = parseLinkedInGrantedScopes(
        (account as { granted_scopes?: unknown }).granted_scopes,
      );
      const missingInsights = missingLinkedInScopesForFeature(granted, "memberInsights");
      if (missingInsights.length > 0) {
        return linkedinContentJson({
          error:
            "Personal LinkedIn insights are not available yet (LinkedIn does not grant r_member_social / r_member_postAnalytics on this app). Select a Company Page for post insights.",
          code: "LINKEDIN_MEMBER_INSIGHTS_UNAVAILABLE",
          missing_scopes: missingInsights,
        }, 400);
      }
    }

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

    const fetchPostsForToken = async (token: string) => {
      if (isPerson) {
        return {
          posts: await fetchLinkedInMemberPosts(token, pageId, dateStart, dateEnd),
          audienceCount: null as number | null,
        };
      }
      const [orgPosts, followers] = await Promise.all([
        fetchLinkedInOrganizationPosts(token, pageId, dateStart, dateEnd),
        fetchLinkedInFollowerCount(token, pageId),
      ]);
      return { posts: orgPosts, audienceCount: followers };
    };

    let posts;
    let audienceCount: number | null = null;
    try {
      ({ posts, audienceCount } = await fetchPostsForToken(accessToken));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("linkedin-content-api getMetrics fetchPosts:", msg);
      if (isPerson && /partnerApiPostsExternal|FINDER-author|Not enough permissions/i.test(msg)) {
        return linkedinContentJson({
          error:
            "Personal LinkedIn insights are not available yet (LinkedIn rejected member post finder). Select a Company Page for post insights.",
          code: "LINKEDIN_MEMBER_INSIGHTS_UNAVAILABLE",
          linkedin_error: msg,
        }, 400);
      }
      if (isLinkedInContentAuthFailure(msg)) {
        // Person OAuth can revoke sibling page tokens; try refresh once before asking reconnect.
        const kind = isPerson ? "person" : "organization";
        const refreshed = await getLinkedInContentAccessToken(admin, organizationId, pageId, {
          forceRefresh: true,
        });
        if (refreshed && refreshed !== accessToken) {
          try {
            ({ posts, audienceCount } = await fetchPostsForToken(refreshed));
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            console.error("linkedin-content-api getMetrics fetchPosts after refresh:", retryMsg);
            return linkedinContentJson({
              error: linkedInContentReauthErrorMessage(kind),
              code: "LINKEDIN_CONTENT_REAUTH_REQUIRED",
              linkedin_error: retryMsg,
            }, 400);
          }
        } else {
          return linkedinContentJson({
            error: linkedInContentReauthErrorMessage(kind),
            code: "LINKEDIN_CONTENT_REAUTH_REQUIRED",
            linkedin_error: msg,
          }, 400);
        }
      } else {
        return linkedinContentJson({ error: msg, code: "LINKEDIN_CONTENT_API_ERROR" }, 400);
      }
    }

    const links = await loadLinkedInPlanLinks(admin, organizationId);
    const matchIndex = buildPlanMatchIndex(links);
    const planIds = [...new Set(links.map((l) => l.social_media_plan_id))];
    const planMap = await loadPlanDetails(admin, planIds);

    // Finder can lag (esp. video still PROCESSING). Merge Synckerja-published links missing
    // from /rest/posts so Performance stays read-after-write — scoped to this page only.
    const seenPostIds = new Set(posts.map((p) => String(p.id ?? "").trim()).filter(Boolean));
    for (const link of links) {
      const ownedBy = String(link.platform_account_open_id ?? "").trim();
      if (ownedBy && ownedBy !== pageId) continue;
      // Unscoped legacy links: only merge onto the org default page to avoid multi-page bleed.
      if (!ownedBy && !account.is_default) continue;
      const id = String(link.external_post_id ?? "").trim()
        || parseLinkedInPostIdFromUrl(link.url)
        || "";
      if (!id || seenPostIds.has(id)) continue;
      seenPostIds.add(id);
      const plan = planMap.get(link.social_media_plan_id);
      const postedMs = plan?.actual_post_date
        ? new Date(plan.actual_post_date).getTime()
        : Date.now();
      posts.push({
        id,
        title: id,
        published_at: new Date(
          Number.isFinite(postedMs) ? postedMs : Date.now(),
        ).toISOString(),
        thumbnail_url: null,
        view_count: 0,
        like_count: 0,
        comment_count: 0,
        share_count: 0,
      });
    }
    posts.sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    });

    // Fill impressions for merge stubs (and any finder row still at 0). Soft-fail inside helper.
    const needImpressionIds = posts
      .map((p) => String(p.id ?? "").trim())
      .filter((id, i) => Boolean(id) && !(Number(posts[i]?.view_count) > 0));
    if (needImpressionIds.length > 0) {
      const impressionMap = isPerson
        ? await fetchMemberCreatorPostAnalytics(accessToken, needImpressionIds, "IMPRESSION")
        : await fetchShareImpressionCounts(accessToken, pageId, needImpressionIds);
      for (const post of posts) {
        const id = String(post.id ?? "").trim();
        if (!id || Number(post.view_count) > 0) continue;
        post.view_count = impressionMap.get(id) ?? 0;
      }
    }

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
      audience_count: audienceCount,
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
