/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  credentialShape,
  describeOrganizationMembership,
  internalSecretMatches,
} from "../_shared/scheduledPosts/scheduledPostsInternalAuth.ts";
import {
  fetchFacebookAdsPosts,
  fetchMetaComments,
  fetchMetaPosts,
  mergeFacebookOrganicAndAdsPosts,
} from "../_shared/metaContentApi.ts";
import { listMetaContentAccounts, resolveMetaContentAccount } from "../_shared/metaContentAuth.ts";
import { getMetaAdsAccessToken } from "../_shared/metaAdsOrgResolver.ts";
import { fetchThreadConversation, fetchThreadsList } from "../_shared/threadsContentApi.ts";
import { resolveOrgThreadsContent } from "../_shared/threadsContentAuth.ts";
import {
  fetchTikTokBusinessVideoList,
  fetchTikTokVideoComments,
  fetchTikTokVideoList,
} from "../_shared/tiktokContentApi.ts";
import { TIKTOK_CONTENT_OAUTH_TOKEN_KINDS } from "../_shared/tiktokContentAuth.ts";
import { pickTikTokAccountLabel } from "../_shared/tiktokContentAccountProfile.ts";
import { resolveOrgTikTokContentForMetrics } from "../_shared/tiktokContentOrgResolver.ts";
import {
  buildYouTubeWatchUrl,
  fetchAllYouTubeVideosInRange,
  fetchYouTubeCommentThreads,
  resolveUploadsPlaylistId,
} from "../_shared/youtubeContentApi.ts";
import { resolveOrgYouTubeContentForMetrics } from "../_shared/youtubeContentOrgResolver.ts";
import {
  buildLinkedInPostUrl,
  fetchLinkedInComments,
  fetchLinkedInOrganizationPosts,
} from "../_shared/linkedinContentApi.ts";
import { resolveOrgLinkedInContentForMetrics } from "../_shared/linkedinContentOrgResolver.ts";
import {
  type AccountStatus,
  COMMENT_PLATFORMS,
  type CommentPlatform,
  DEFAULT_POSTS_PER_ACCOUNT,
  jakartaBounds,
  MAX_ACCOUNTS_PER_PLATFORM,
  MAX_COMMENTS_RETURNED,
  MAX_POSTS_PER_ACCOUNT,
  newestFirst,
  pickPosts,
  type PostRef,
  publicError,
  type RawComment,
  runLimited,
  shapePostComments,
  shiftYmd,
  type SocialComment,
  withTimeout,
} from "./shape.ts";

// Read-only comments door for the Synckerja MCP connector. The caller presents
// SCHEDULED_POSTS_INTERNAL_SECRET plus the session user id, like mcp-ads-performance.
// It never replies, hides, likes, or marks anything as read.

const OVERALL_BUDGET_MS = 45_000;
const CALL_TIMEOUT_MS = 12_000;
const POST_CONCURRENCY = 4;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function reject(reason: string, error: string, status: number, extra: Record<string, unknown> = {}): Response {
  console.error("mcp-social-comments: rejected", { reason, ...extra });
  return json({ error }, status);
}

function internalDoor(req: Request, body: Record<string, unknown>): Response | null {
  const secret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  const provided = typeof body.internal_secret === "string" ? body.internal_secret : "";
  if (!secret) return reject("secret_missing", "misconfigured", 500);
  if (!internalSecretMatches(provided, secret)) {
    const header = req.headers.get("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    return reject("secret_rejected", "forbidden: internal credential rejected", 403, {
      bearerShape: credentialShape(token),
    });
  }
  return null;
}

function parseYmd(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(text);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === text ? text : null;
}

type Ctx = {
  admin: SupabaseClient;
  organizationId: string;
  startYmd: string;
  endYmd: string;
  fromMs: number;
  toMs: number;
  postsPerAccount: number;
  deadlineMs: number;
};

type AccountJob = {
  platform: CommentPlatform;
  label: string;
  posts: () => Promise<PostRef[]>;
  comments: (post: PostRef) => Promise<RawComment[]>;
};

type AccountResult = { status: AccountStatus; comments: SocialComment[] };

function str(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unixToIso(value: unknown): string | null {
  const n = num(value);
  return n && n > 0 ? new Date(n * 1000).toISOString() : null;
}

// ---------- engagement state kept by Synckerja (read, liked, replied) ----------

async function engagementSets(
  ctx: Ctx,
  platform: CommentPlatform,
  commentIds: string[],
): Promise<{ handled: Set<string>; replied: Set<string> }> {
  const handled = new Set<string>();
  const replied = new Set<string>();
  if (commentIds.length === 0) return { handled, replied };
  const table = platform === "instagram" || platform === "facebook"
    ? "meta_manage_comments_comment_engagements"
    : `${platform}_manage_comments_comment_engagements`;
  const withType = platform === "tiktok";
  for (let i = 0; i < commentIds.length; i += 200) {
    const chunk = commentIds.slice(i, i + 200);
    let query = ctx.admin
      .from(table)
      .select(withType ? "comment_id, engagement_type" : "comment_id")
      .eq("organization_id", ctx.organizationId)
      .in("comment_id", chunk);
    if (platform === "instagram" || platform === "facebook") query = query.eq("platform", platform);
    const { data, error } = await query;
    if (error) {
      console.warn("mcp-social-comments: engagement read skipped", { platform, code: error.code ?? "" });
      continue;
    }
    for (const row of (data ?? []) as Array<{ comment_id?: string; engagement_type?: string }>) {
      const id = str(row.comment_id);
      if (!id) continue;
      handled.add(id);
      if (row.engagement_type === "reply") replied.add(id);
    }
  }
  return { handled, replied };
}

// ---------- platform adapters ----------

async function metaJobs(ctx: Ctx, platform: "instagram" | "facebook"): Promise<AccountJob[]> {
  const accounts = (await listMetaContentAccounts(ctx.admin, ctx.organizationId))
    .filter((row) => row.platform === platform)
    .slice(0, MAX_ACCOUNTS_PER_PLATFORM);
  const jobs: AccountJob[] = [];
  for (const row of accounts) {
    const resolved = await resolveMetaContentAccount(ctx.admin, ctx.organizationId, platform, row.account_id);
    if (!resolved) continue;
    const token = resolved.pageAccessToken;
    const ownerName = (resolved.accountLabel ?? "").trim().toLowerCase();
    jobs.push({
      platform,
      label: resolved.accountLabel,
      posts: async () => {
        const organic = await fetchMetaPosts(platform, {
          pageId: resolved.pageId,
          igBusinessAccountId: resolved.igBusinessAccountId,
          pageAccessToken: token,
        }, ctx.postsPerAccount);
        let posts = organic;
        if (platform === "facebook") {
          // Ad comments live on dark posts. Never let the ads lookup take the organic list down.
          try {
            const adsToken = await getMetaAdsAccessToken(ctx.admin, ctx.organizationId);
            if (adsToken) {
              const { data: adRows } = await ctx.admin
                .from("organization_meta_ads_accounts")
                .select("ad_account_id")
                .eq("organization_id", ctx.organizationId)
                .limit(5);
              const adAccountIds = ((adRows ?? []) as Array<{ ad_account_id?: string }>)
                .map((r) => String(r.ad_account_id ?? "").trim())
                .filter(Boolean);
              const ads = await withTimeout(
                fetchFacebookAdsPosts({
                  pageId: resolved.pageId,
                  pageAccessToken: token,
                  adsUserToken: adsToken,
                  adAccountIds,
                  limit: 10,
                }),
                CALL_TIMEOUT_MS,
                "facebook_ads_posts",
              );
              posts = mergeFacebookOrganicAndAdsPosts(organic, ads.posts);
            }
          } catch (error) {
            console.warn("mcp-social-comments: facebook ads posts skipped", publicError(error));
          }
        }
        return posts.map((post) => ({
          id: post.id,
          caption: post.caption,
          url: post.permalink,
          publishedAt: post.timestamp,
          isAd: Boolean(post.is_ad),
          commentCount: num(post.comment_count),
        }));
      },
      comments: async (post) => {
        const rows = await fetchMetaComments(platform, post.id, token);
        return rows.map((c) => ({
          id: c.id,
          parentId: c.parent_comment_id,
          text: c.text,
          author: c.author_name || null,
          publishedAt: c.published_at,
          likeCount: num(c.like_count),
          replyCount: num(c.reply_count) ?? 0,
          isOwner: platform === "facebook"
            ? Boolean(c.author_id && c.author_id === resolved.pageId)
            : Boolean(ownerName && (c.author_name ?? "").trim().toLowerCase() === ownerName),
        }));
      },
    });
  }
  return jobs;
}

async function threadsJobs(ctx: Ctx): Promise<AccountJob[]> {
  const resolved = await resolveOrgThreadsContent(ctx.admin, ctx.organizationId, null);
  if (!resolved) return [];
  const { accessToken, account } = resolved;
  return [{
    platform: "threads",
    label: account.accountLabel,
    posts: async () => {
      const posts = await fetchThreadsList(accessToken, ctx.postsPerAccount);
      return posts.map((post) => ({
        id: post.id,
        caption: post.caption,
        url: post.permalink,
        publishedAt: post.timestamp,
        isAd: false,
        commentCount: null,
      }));
    },
    comments: async (post) => {
      const rows = await fetchThreadConversation(post.id, accessToken);
      return rows
        .filter((c) => c.id !== post.id)
        .map((c) => ({
          id: c.id,
          parentId: c.parent_comment_id,
          text: c.text,
          author: c.author_name || null,
          publishedAt: c.published_at,
          likeCount: null,
          replyCount: num(c.reply_count) ?? 0,
          isOwner: Boolean(c.is_owner),
        }));
    },
  }];
}

async function activeAccountIds(ctx: Ctx, table: string, idColumn: string): Promise<string[]> {
  const { data, error } = await ctx.admin
    .from(table)
    .select(idColumn)
    .eq("organization_id", ctx.organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(MAX_ACCOUNTS_PER_PLATFORM);
  if (error) throw new Error("account_lookup_failed");
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => str(row[idColumn]))
    .filter((id): id is string => Boolean(id));
}

async function tiktokJobs(ctx: Ctx): Promise<AccountJob[]> {
  const openIds = await activeAccountIds(ctx, "organization_tiktok_content_accounts", "open_id");
  const jobs: AccountJob[] = [];
  for (const openId of openIds) {
    const resolved = await resolveOrgTikTokContentForMetrics(ctx.admin, ctx.organizationId, openId);
    if (!resolved) continue;
    const { accessToken, account, tokenKind } = resolved;
    const businessId = account.open_id;
    jobs.push({
      platform: "tiktok",
      label: pickTikTokAccountLabel(account),
      posts: async () => {
        const batch = tokenKind === TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.ttUser
          ? await fetchTikTokBusinessVideoList(accessToken, businessId, undefined, Math.min(ctx.postsPerAccount, 20))
          : await fetchTikTokVideoList(accessToken, undefined, Math.min(ctx.postsPerAccount, 20));
        return batch.videos
          .filter((video) => str(video.id))
          .map((video) => ({
            id: String(video.id),
            caption: str(video.title) ?? str(video.video_description),
            url: str(video.share_url),
            publishedAt: unixToIso(video.create_time),
            isAd: false,
            commentCount: num(video.comment_count),
          }));
      },
      comments: async (post) => {
        const batch = await fetchTikTokVideoComments(accessToken, businessId, post.id, 0, 50, tokenKind);
        // TikTok lists replies separately; owner replies are known only from Synckerja engagements.
        return batch.comments.map((c) => ({
          id: c.id,
          parentId: c.parent_comment_id,
          text: c.text,
          author: c.display_name ?? null,
          publishedAt: unixToIso(c.create_time),
          likeCount: num(c.like_count),
          replyCount: num(c.reply_count) ?? 0,
          isOwner: false,
        }));
      },
    });
  }
  return jobs;
}

async function youtubeJobs(ctx: Ctx): Promise<AccountJob[]> {
  const channelIds = await activeAccountIds(ctx, "organization_youtube_content_accounts", "channel_id");
  const jobs: AccountJob[] = [];
  for (const channelIdParam of channelIds) {
    const resolved = await resolveOrgYouTubeContentForMetrics(ctx.admin, ctx.organizationId, channelIdParam);
    if (!resolved) continue;
    const { accessToken, account } = resolved;
    const channelId = account.channel_id;
    jobs.push({
      platform: "youtube",
      label: account.label || account.display_name || channelId,
      posts: async () => {
        const uploads = await resolveUploadsPlaylistId(accessToken, channelId);
        if (!uploads) return [];
        const videos = await fetchAllYouTubeVideosInRange(
          accessToken, channelId, uploads, shiftYmd(ctx.endYmd, -180), ctx.endYmd, 2,
        );
        return videos
          .filter((video) => str(video.id))
          .map((video) => ({
            id: String(video.id),
            caption: str(video.title),
            url: buildYouTubeWatchUrl(String(video.id)),
            publishedAt: str(video.published_at),
            isAd: false,
            commentCount: num(video.comment_count),
          }));
      },
      comments: async (post) => {
        const rows = await fetchYouTubeCommentThreads(accessToken, channelId, post.id, 100);
        return rows.map((c) => ({
          id: c.id,
          parentId: c.parent_comment_id,
          text: c.text,
          author: c.author_display_name || null,
          publishedAt: c.published_at,
          likeCount: num(c.like_count),
          replyCount: num(c.reply_count) ?? 0,
          isOwner: Boolean(c.is_channel_owner),
        }));
      },
    });
  }
  return jobs;
}

async function linkedinJobs(ctx: Ctx): Promise<AccountJob[]> {
  const pageIds = await activeAccountIds(ctx, "organization_linkedin_content_accounts", "page_id");
  const jobs: AccountJob[] = [];
  for (const pageIdParam of pageIds) {
    const resolved = await resolveOrgLinkedInContentForMetrics(ctx.admin, ctx.organizationId, pageIdParam);
    if (!resolved) continue;
    const { accessToken, account } = resolved;
    const pageId = account.page_id;
    jobs.push({
      platform: "linkedin",
      label: account.label || account.display_name || pageId,
      posts: async () => {
        const posts = await fetchLinkedInOrganizationPosts(
          accessToken, pageId, shiftYmd(ctx.endYmd, -90), ctx.endYmd, 2,
        );
        return posts
          .filter((post) => str(post.id))
          .map((post) => ({
            id: String(post.id),
            caption: str(post.title),
            url: buildLinkedInPostUrl(String(post.id)),
            publishedAt: str(post.published_at),
            isAd: false,
            commentCount: num(post.comment_count),
          }));
      },
      comments: async (post) => {
        const rows = await fetchLinkedInComments(accessToken, post.id, pageId);
        return rows.map((c) => ({
          id: c.id,
          parentId: c.parent_comment_id,
          text: c.text,
          author: c.author_name,
          publishedAt: c.published_at,
          likeCount: num(c.like_count),
          replyCount: num(c.reply_count) ?? 0,
          isOwner: Boolean(c.is_owner),
        }));
      },
    });
  }
  return jobs;
}

function jobsFor(ctx: Ctx, platform: CommentPlatform): Promise<AccountJob[]> {
  switch (platform) {
    case "instagram":
    case "facebook":
      return metaJobs(ctx, platform);
    case "threads":
      return threadsJobs(ctx);
    case "tiktok":
      return tiktokJobs(ctx);
    case "youtube":
      return youtubeJobs(ctx);
    case "linkedin":
      return linkedinJobs(ctx);
  }
}

async function runAccount(ctx: Ctx, job: AccountJob): Promise<AccountResult> {
  const status: AccountStatus = {
    platform: job.platform,
    account_label: job.label,
    status: "ok",
    error: null,
    posts_scanned: 0,
    comments_in_period: 0,
    partial: false,
  };
  let posts: PostRef[];
  try {
    posts = pickPosts(await withTimeout(job.posts(), CALL_TIMEOUT_MS, "posts"), ctx.toMs, ctx.postsPerAccount);
  } catch (error) {
    return { status: { ...status, status: "error", error: publicError(error) }, comments: [] };
  }

  const perPost: Array<{ post: PostRef; rows: RawComment[] }> = [];
  let failures = 0;
  let lastError: string | null = null;
  const { skipped } = await runLimited(
    posts.map((post) => async () => {
      try {
        perPost.push({ post, rows: await withTimeout(job.comments(post), CALL_TIMEOUT_MS, "comments") });
      } catch (error) {
        failures += 1;
        lastError = publicError(error);
      }
    }),
    POST_CONCURRENCY,
    ctx.deadlineMs,
  );

  const ids = perPost.flatMap(({ rows }) => rows.filter((r) => !r.parentId).map((r) => r.id));
  const { handled, replied } = await engagementSets(ctx, job.platform, ids);
  const comments = perPost.flatMap(({ post, rows }) =>
    shapePostComments({
      platform: job.platform,
      accountLabel: job.label,
      post,
      rows,
      fromMs: ctx.fromMs,
      toMs: ctx.toMs,
      handled,
      repliedInSynckerja: replied,
    })
  );

  status.posts_scanned = perPost.length;
  status.comments_in_period = comments.length;
  status.partial = skipped > 0 || failures > 0;
  if (perPost.length === 0 && failures > 0) {
    status.status = "error";
    status.error = lastError;
  } else if (failures > 0) {
    status.error = `${failures} post(s) could not be read: ${lastError ?? "request_failed"}`;
  }
  return { status, comments };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "misconfigured" }, 500);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  const door = internalDoor(req, body);
  if (door) return door;

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const userId = String(body.mcp_user_id ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!uuid.test(userId) || !uuid.test(organizationId)) return json({ error: "invalid_input" }, 400);

  const platformRaw = body.platform == null || body.platform === "" ? null : String(body.platform);
  if (platformRaw && !(COMMENT_PLATFORMS as readonly string[]).includes(platformRaw)) {
    return json({ error: "invalid_input" }, 400);
  }
  const startYmd = parseYmd(body.date_start);
  const endYmd = parseYmd(body.date_end);
  if (!startYmd || !endYmd || startYmd > endYmd) return json({ error: "invalid_input" }, 400);
  const postsRaw = body.posts_per_account == null ? DEFAULT_POSTS_PER_ACCOUNT : Number(body.posts_per_account);
  if (!Number.isInteger(postsRaw) || postsRaw < 1 || postsRaw > MAX_POSTS_PER_ACCOUNT) {
    return json({ error: "invalid_input" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const membership = await describeOrganizationMembership(admin, userId, organizationId);
  if (membership.state === "policy") return reject("database_policy", "forbidden: database policy denied", 403);
  if (membership.state === "query_failed") return reject("database_query_failed", "comments_unavailable", 500);
  if (membership.state !== "active") {
    return reject("membership", "forbidden: organization mismatch", 403, { organizationId });
  }

  const { fromMs, toMs } = jakartaBounds(startYmd, endYmd);
  const ctx: Ctx = {
    admin,
    organizationId,
    startYmd,
    endYmd,
    fromMs,
    toMs,
    postsPerAccount: postsRaw,
    deadlineMs: Date.now() + OVERALL_BUDGET_MS,
  };

  const platforms = platformRaw ? [platformRaw as CommentPlatform] : [...COMMENT_PLATFORMS];
  const perPlatform = await Promise.all(platforms.map(async (platform) => {
    let jobs: AccountJob[];
    try {
      jobs = await withTimeout(jobsFor(ctx, platform), CALL_TIMEOUT_MS, "accounts");
    } catch (error) {
      const failed: AccountStatus = {
        platform,
        account_label: null,
        status: "error",
        error: publicError(error),
        posts_scanned: 0,
        comments_in_period: 0,
        partial: false,
      };
      return [{ status: failed, comments: [] as SocialComment[] }];
    }
    if (jobs.length === 0) {
      const none: AccountStatus = {
        platform,
        account_label: null,
        status: "not_connected",
        error: null,
        posts_scanned: 0,
        comments_in_period: 0,
        partial: false,
      };
      return [{ status: none, comments: [] as SocialComment[] }];
    }
    return Promise.all(jobs.map((job) => runAccount(ctx, job)));
  }));

  const results = perPlatform.flat();
  const all = newestFirst(results.flatMap((result) => result.comments));
  return json({
    period: { start: startYmd, end: endYmd },
    posts_per_account: postsRaw,
    accounts: results.map((result) => result.status),
    comments_total: all.length,
    truncated: all.length > MAX_COMMENTS_RETURNED,
    comments: all.slice(0, MAX_COMMENTS_RETURNED),
  });
});
