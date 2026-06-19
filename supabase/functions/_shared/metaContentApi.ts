import type { MetaContentPlatform } from "./metaContentAuth.ts";
import { graphUrl } from "./metaContentAuth.ts";

/** Accepts YYYY-MM-DD or unix timestamp strings for Graph API since/until. */
export function toMetaGraphSinceUntil(
  dateStart: string,
  dateEnd: string,
): { since: string; until: string } {
  const nowSec = Math.floor(Date.now() / 1000);
  const defaultSince = String(nowSec - 7 * 86400);
  const defaultUntil = String(nowSec);
  const maxSpanSec = 30 * 86400;

  const parseInput = (raw: string, endOfDay: boolean): string => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (/^\d+$/.test(trimmed)) return trimmed;
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const [, y, m, d] = ymd;
      const date = new Date(
        Date.UTC(
          Number(y),
          Number(m) - 1,
          Number(d),
          endOfDay ? 23 : 0,
          endOfDay ? 59 : 0,
          endOfDay ? 59 : 0,
        ),
      );
      return String(Math.floor(date.getTime() / 1000));
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) return String(Math.floor(parsed / 1000));
    return "";
  };

  let sinceSec = Number(parseInput(dateStart, false) || defaultSince);
  let untilSec = Number(parseInput(dateEnd, true) || defaultUntil);

  if (!Number.isFinite(sinceSec)) sinceSec = Number(defaultSince);
  if (!Number.isFinite(untilSec)) untilSec = Number(defaultUntil);
  if (untilSec > nowSec) untilSec = nowSec;
  if (sinceSec > untilSec) sinceSec = untilSec;
  if (untilSec - sinceSec > maxSpanSec) {
    sinceSec = untilSec - maxSpanSec;
  }

  return { since: String(sinceSec), until: String(untilSec) };
}

export type MetaContentPost = {
  id: string;
  caption: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
  comment_count: number;
  like_count: number;
  /** Populated when Facebook post list includes inline insights field expansion. */
  insight_views?: number;
  insight_reach?: number;
};

export type MetaContentComment = {
  id: string;
  media_id: string;
  text: string;
  author_name: string;
  author_id: string | null;
  like_count: number;
  reply_count: number;
  parent_comment_id: string | null;
  published_at: string | null;
  is_owner: boolean;
  can_reply: boolean;
};

type GraphError = { error?: { message?: string; code?: number } };

async function graphGet<T>(url: string, accessToken: string): Promise<T> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json().catch(() => ({})) as T & GraphError;
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message ?? `Graph API error ${res.status}`);
  }
  return data;
}

async function graphPost<T>(url: string, accessToken: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: accessToken }).toString(),
  });
  const data = await res.json().catch(() => ({})) as T & GraphError;
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message ?? `Graph API error ${res.status}`);
  }
  return data;
}

export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
  limit = 25,
): Promise<MetaContentPost[]> {
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count";
  const url = graphUrl(`${igUserId}/media`, {
    fields,
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });
  const data = await graphGet<{ data?: Array<Record<string, unknown>> }>(url, accessToken);
  return (data.data ?? []).map(mapIgMedia);
}

function timestampToUtcYmd(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function filterPostsByYmdRange(
  posts: MetaContentPost[],
  startYmd: string,
  endYmd: string,
): MetaContentPost[] {
  const start = startYmd.trim();
  const end = endYmd.trim();
  if (!start || !end) return posts;
  return posts.filter((post) => {
    if (!post.timestamp) return false;
    const ymd = timestampToUtcYmd(post.timestamp);
    if (!ymd) return false;
    return ymd >= start && ymd <= end;
  });
}

export function filterPostsByUnixRange(
  posts: MetaContentPost[],
  since: string,
  until: string,
): MetaContentPost[] {
  const sinceSec = Number(since);
  const untilSec = Number(until);
  if (!Number.isFinite(sinceSec) || !Number.isFinite(untilSec)) return posts;
  return posts.filter((post) => {
    if (!post.timestamp) return false;
    const postedSec = Math.floor(new Date(post.timestamp).getTime() / 1000);
    return postedSec >= sinceSec && postedSec <= untilSec;
  });
}

/**
 * Fetches recent IG media pages until we collect posts published in the date range
 * (matches date picker YMD). Never returns media outside the range.
 */
export async function resolveInstagramPostsForMetrics(
  igUserId: string,
  accessToken: string,
  limit: number,
  dateRange?: { startYmd: string; endYmd: string },
): Promise<MetaContentPost[]> {
  if (!dateRange?.startYmd || !dateRange?.endYmd) {
    return fetchInstagramMedia(igUserId, accessToken, limit);
  }

  const { startYmd, endYmd } = dateRange;
  const inRange: MetaContentPost[] = [];
  let after: string | undefined;
  const maxPages = 25;

  for (let page = 0; page < maxPages && inRange.length < limit; page++) {
    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count";
    const params: Record<string, string> = {
      fields,
      limit: "50",
    };
    if (after) params.after = after;

    const data = await graphGet<{
      data?: Array<Record<string, unknown>>;
      paging?: { cursors?: { after?: string } };
    }>(graphUrl(`${igUserId}/media`, params), accessToken);

    const batch = (data.data ?? []).map(mapIgMedia);
    if (batch.length === 0) break;

    for (const post of batch) {
      if (!post.timestamp) continue;
      const ymd = timestampToUtcYmd(post.timestamp);
      if (ymd >= startYmd && ymd <= endYmd) {
        inRange.push(post);
        if (inRange.length >= limit) break;
      }
    }

    const oldest = batch[batch.length - 1];
    const oldestYmd = oldest?.timestamp ? timestampToUtcYmd(oldest.timestamp) : "";
    if (oldestYmd && oldestYmd < startYmd) break;

    after = data.paging?.cursors?.after;
    if (!after) break;
  }

  return inRange;
}

type FbInsightMetricRow = {
  name?: string;
  values?: Array<{ value?: number }>;
  total_value?: { value?: number };
};

function parseFbInsightMetricValue(row: FbInsightMetricRow): number {
  if (row.total_value != null && Number.isFinite(Number(row.total_value.value))) {
    return Number(row.total_value.value);
  }
  return (row.values ?? []).reduce((acc, v) => acc + Number(v.value ?? 0), 0);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchFacebookPostReactionCount(postId: string, accessToken: string): Promise<number> {
  try {
    const data = await graphGet<{ summary?: { total_count?: number } }>(
      graphUrl(`${postId}/reactions`, { summary: "true", limit: "0" }),
      accessToken,
    );
    return Number(data.summary?.total_count ?? 0);
  } catch {
    return 0;
  }
}

async function fetchFacebookPostCommentCount(postId: string, accessToken: string): Promise<number> {
  try {
    const data = await graphGet<{ summary?: { total_count?: number } }>(
      graphUrl(`${postId}/comments`, { summary: "true", limit: "0" }),
      accessToken,
    );
    return Number(data.summary?.total_count ?? 0);
  } catch {
    return 0;
  }
}

export async function hydrateFacebookPostMetrics(
  post: MetaContentPost,
  accessToken: string,
): Promise<{ like_count: number; comment_count: number; view_count: number; reach: number }> {
  let likeCount = post.like_count;
  let commentCount = post.comment_count;
  let viewCount = post.insight_views ?? 0;
  let reach = post.insight_reach ?? 0;

  try {
    const row = await graphGet<Record<string, unknown>>(
      graphUrl(post.id, { fields: "reactions.summary(true),comments.summary(true),likes.summary(true)" }),
      accessToken,
    );
    const mapped = mapFbPost({ ...row, id: post.id });
    likeCount = Math.max(likeCount, mapped.like_count);
    commentCount = Math.max(commentCount, mapped.comment_count);
  } catch {
    // fall through to edge endpoints
  }

  if (likeCount === 0) {
    likeCount = await fetchFacebookPostReactionCount(post.id, accessToken);
  }
  if (commentCount === 0) {
    commentCount = await fetchFacebookPostCommentCount(post.id, accessToken);
  }

  if (viewCount === 0 || reach === 0) {
    const insights = await fetchFacebookPostInsights(post.id, accessToken, {
      insight_views: post.insight_views,
      insight_reach: post.insight_reach,
    });
    viewCount = Math.max(viewCount, insights.impressions);
    reach = Math.max(reach, insights.reach);
  }

  if (reach > 0 && viewCount < reach) viewCount = reach;

  return {
    like_count: likeCount,
    comment_count: commentCount,
    view_count: viewCount,
    reach,
  };
}

export type FacebookMetricsPostRow = {
  platform: MetaContentPlatform;
  account_id: string;
  content_id: string;
  posted_at: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  reach: number;
  engagement_rate: number | null;
  caption: string | null;
  media_url: string | null;
  permalink: string | null;
};

export async function buildFacebookMetricsPostRows(
  posts: MetaContentPost[],
  accessToken: string,
  accountId: string,
): Promise<FacebookMetricsPostRow[]> {
  return mapWithConcurrency(posts, 6, async (p) => {
    const m = await hydrateFacebookPostMetrics(p, accessToken);
    return {
      platform: "facebook",
      account_id: accountId,
      content_id: p.id,
      posted_at: p.timestamp,
      view_count: m.view_count,
      like_count: m.like_count,
      comment_count: m.comment_count,
      share_count: 0,
      reach: m.reach,
      engagement_rate: computeMetaEngagementRate(m.like_count, m.comment_count, m.view_count),
      caption: p.caption,
      media_url: p.media_url ?? p.thumbnail_url,
      permalink: p.permalink,
    };
  });
}

export type InstagramMetricsPostRow = FacebookMetricsPostRow;

export async function buildInstagramMetricsPostRows(
  posts: MetaContentPost[],
  accessToken: string,
  accountId: string,
): Promise<InstagramMetricsPostRow[]> {
  return mapWithConcurrency(posts, 6, async (p) => {
    const mediaInsights = await fetchInstagramMediaInsights(p.id, accessToken);
    const viewCount = mediaInsights.impressions;
    const likeCount = p.like_count;
    const commentCount = p.comment_count;
    return {
      platform: "instagram",
      account_id: accountId,
      content_id: p.id,
      posted_at: p.timestamp,
      view_count: viewCount,
      like_count: likeCount,
      comment_count: commentCount,
      share_count: 0,
      reach: mediaInsights.reach,
      engagement_rate: computeMetaEngagementRate(likeCount, commentCount, viewCount),
      caption: p.caption,
      media_url: p.media_url ?? p.thumbnail_url,
      permalink: p.permalink,
    };
  });
}

const FB_POST_LIST_FIELDS = [
  "id",
  "message",
  "created_time",
  "permalink_url",
  "full_picture",
  "comments.summary(true)",
  "reactions.summary(true)",
  "likes.summary(true)",
].join(",");

async function fetchFacebookPostsFromEndpoint(
  endpoint: string,
  accessToken: string,
  limit: number,
  dateRange?: { startYmd: string; endYmd: string },
): Promise<{ posts: MetaContentPost[]; sawAnyBatch: boolean }> {
  const inRange: MetaContentPost[] = [];
  let after: string | undefined;
  const maxPages = dateRange?.startYmd && dateRange?.endYmd ? 25 : 1;
  let sawAnyBatch = false;

  for (let page = 0; page < maxPages && inRange.length < limit; page++) {
    const params: Record<string, string> = {
      fields: FB_POST_LIST_FIELDS,
      limit: dateRange?.startYmd && dateRange?.endYmd
        ? "50"
        : String(Math.min(Math.max(limit, 1), 100)),
    };
    if (after) params.after = after;

    const data = await graphGet<{
      data?: Array<Record<string, unknown>>;
      paging?: { cursors?: { after?: string } };
    }>(graphUrl(endpoint, params), accessToken);

    const batch = (data.data ?? []).map(mapFbPost);
    if (batch.length === 0) break;
    sawAnyBatch = true;

    if (!dateRange?.startYmd || !dateRange?.endYmd) {
      return { posts: batch.slice(0, limit), sawAnyBatch: true };
    }

    for (const post of batch) {
      if (!post.timestamp) continue;
      const ymd = timestampToUtcYmd(post.timestamp);
      if (ymd >= dateRange.startYmd && ymd <= dateRange.endYmd) {
        inRange.push(post);
        if (inRange.length >= limit) break;
      }
    }

    const oldest = batch[batch.length - 1];
    const oldestYmd = oldest?.timestamp ? timestampToUtcYmd(oldest.timestamp) : "";
    if (oldestYmd && oldestYmd < dateRange.startYmd) break;

    after = data.paging?.cursors?.after;
    if (!after) break;
  }

  return { posts: inRange, sawAnyBatch };
}

/**
 * Fetches Facebook page posts, optionally paginating until enough posts fall in the YMD range.
 */
export async function resolveFacebookPostsForMetrics(
  pageId: string,
  accessToken: string,
  limit: number,
  dateRange?: { startYmd: string; endYmd: string },
): Promise<MetaContentPost[]> {
  const listEndpoints = [
    `${pageId}/published_posts`,
    `${pageId}/posts`,
  ];

  for (const endpoint of listEndpoints) {
    try {
      const { posts, sawAnyBatch } = await fetchFacebookPostsFromEndpoint(
        endpoint,
        accessToken,
        limit,
        dateRange,
      );
      if (posts.length > 0) return posts;
      if (sawAnyBatch) return [];
    } catch {
      // try next endpoint
    }
  }

  return [];
}

export async function fetchFacebookPosts(
  pageId: string,
  accessToken: string,
  limit = 25,
): Promise<MetaContentPost[]> {
  return resolveFacebookPostsForMetrics(pageId, accessToken, limit);
}

function mapIgMedia(row: Record<string, unknown>): MetaContentPost {
  return {
    id: String(row.id ?? ""),
    caption: typeof row.caption === "string" ? row.caption : null,
    media_type: typeof row.media_type === "string" ? row.media_type : null,
    media_url: typeof row.media_url === "string" ? row.media_url : null,
    thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    permalink: typeof row.permalink === "string" ? row.permalink : null,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
    comment_count: Number(row.comments_count ?? 0),
    like_count: Number(row.like_count ?? 0),
  };
}

function parseFbInlineInsights(row: Record<string, unknown>): { views: number; reach: number } {
  const insights = row.insights as { data?: FbInsightMetricRow[] } | undefined;
  const out: Record<string, number> = {};
  for (const metric of insights?.data ?? []) {
    out[String(metric.name ?? "")] = parseFbInsightMetricValue(metric);
  }
  return {
    views: out.post_media_view ?? out.post_impressions ?? 0,
    reach: out.post_total_media_view_unique ?? out.post_impressions_unique ?? 0,
  };
}

function mapFbPost(row: Record<string, unknown>): MetaContentPost {
  const comments = row.comments as { summary?: { total_count?: number } } | undefined;
  const reactions = row.reactions as { summary?: { total_count?: number } } | undefined;
  const likes = row.likes as { summary?: { total_count?: number } } | undefined;
  const inline = parseFbInlineInsights(row);
  return {
    id: String(row.id ?? ""),
    caption: typeof row.message === "string" ? row.message : null,
    media_type: "post",
    media_url: typeof row.full_picture === "string" ? row.full_picture : null,
    thumbnail_url: typeof row.full_picture === "string" ? row.full_picture : null,
    permalink: typeof row.permalink_url === "string" ? row.permalink_url : null,
    timestamp: typeof row.created_time === "string" ? row.created_time : null,
    comment_count: Number(comments?.summary?.total_count ?? 0),
    like_count: Number(
      reactions?.summary?.total_count ?? likes?.summary?.total_count ?? 0,
    ),
    insight_views: inline.views > 0 ? inline.views : undefined,
    insight_reach: inline.reach > 0 ? inline.reach : undefined,
  };
}

export async function fetchInstagramComments(
  mediaId: string,
  accessToken: string,
): Promise<MetaContentComment[]> {
  const fields = "id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}";
  const url = graphUrl(`${mediaId}/comments`, { fields });
  const data = await graphGet<{ data?: Array<Record<string, unknown>> }>(url, accessToken);
  const topLevel = (data.data ?? []).flatMap((row) => {
    const parent = mapIgComment(row, mediaId, null);
    const replies = row.replies as { data?: Array<Record<string, unknown>> } | undefined;
    const replyRows = (replies?.data ?? []).map((r) => mapIgComment(r, mediaId, parent.id));
    return [parent, ...replyRows];
  });
  return topLevel;
}

function mapIgComment(
  row: Record<string, unknown>,
  mediaId: string,
  parentId: string | null,
): MetaContentComment {
  return {
    id: String(row.id ?? ""),
    media_id: mediaId,
    text: typeof row.text === "string" ? row.text : "",
    author_name: typeof row.username === "string" ? row.username : "Unknown",
    author_id: null,
    like_count: Number(row.like_count ?? 0),
    reply_count: 0,
    parent_comment_id: parentId,
    published_at: typeof row.timestamp === "string" ? row.timestamp : null,
    is_owner: false,
    can_reply: true,
  };
}

export async function fetchFacebookComments(
  postId: string,
  accessToken: string,
): Promise<MetaContentComment[]> {
  const fields = "id,message,from,created_time,like_count,comment_count,comments{id,message,from,created_time,like_count}";
  const url = graphUrl(`${postId}/comments`, { fields });
  const data = await graphGet<{ data?: Array<Record<string, unknown>> }>(url, accessToken);
  return (data.data ?? []).flatMap((row) => {
    const parent = mapFbComment(row, postId, null);
    const nested = row.comments as { data?: Array<Record<string, unknown>> } | undefined;
    const replies = (nested?.data ?? []).map((r) => mapFbComment(r, postId, parent.id));
    return [parent, ...replies];
  });
}

function mapFbComment(
  row: Record<string, unknown>,
  mediaId: string,
  parentId: string | null,
): MetaContentComment {
  const from = row.from as { id?: string; name?: string } | undefined;
  return {
    id: String(row.id ?? ""),
    media_id: mediaId,
    text: typeof row.message === "string" ? row.message : "",
    author_name: typeof from?.name === "string" ? from.name : "Unknown",
    author_id: typeof from?.id === "string" ? from.id : null,
    like_count: Number(row.like_count ?? 0),
    reply_count: Number(row.comment_count ?? 0),
    parent_comment_id: parentId,
    published_at: typeof row.created_time === "string" ? row.created_time : null,
    is_owner: false,
    can_reply: true,
  };
}

export async function replyInstagramComment(
  commentId: string,
  text: string,
  accessToken: string,
): Promise<{ id: string }> {
  const url = graphUrl(`${commentId}/replies`);
  const data = await graphPost<{ id?: string }>(url, accessToken, { message: text });
  return { id: String(data.id ?? "") };
}

export async function replyFacebookComment(
  commentId: string,
  text: string,
  accessToken: string,
): Promise<{ id: string }> {
  const url = graphUrl(`${commentId}/comments`);
  const data = await graphPost<{ id?: string }>(url, accessToken, { message: text });
  return { id: String(data.id ?? "") };
}

type IgInsightMetricRow = {
  name?: string;
  values?: Array<{ value?: number }>;
  total_value?: { value?: number };
};

function parseIgInsightMetricValue(row: IgInsightMetricRow): number {
  if (row.total_value != null && Number.isFinite(Number(row.total_value.value))) {
    return Number(row.total_value.value);
  }
  return (row.values ?? []).reduce((acc, v) => acc + Number(v.value ?? 0), 0);
}

export async function fetchMetaAudienceCount(
  platform: MetaContentPlatform,
  igBusinessAccountId: string | null,
  pageId: string,
  accessToken: string,
): Promise<number | null> {
  try {
    if (platform === "instagram" && igBusinessAccountId) {
      const data = await graphGet<{ followers_count?: number }>(
        graphUrl(igBusinessAccountId, { fields: "followers_count" }),
        accessToken,
      );
      const count = Number(data.followers_count ?? NaN);
      return Number.isFinite(count) ? count : null;
    }
    if (platform === "facebook" && pageId) {
      const data = await graphGet<{ followers_count?: number; fan_count?: number }>(
        graphUrl(pageId, { fields: "followers_count,fan_count" }),
        accessToken,
      );
      const count = Number(data.followers_count ?? data.fan_count ?? NaN);
      return Number.isFinite(count) ? count : null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchInstagramAccountInsights(
  igUserId: string,
  accessToken: string,
  since: string,
  until: string,
): Promise<{ reach: number; impressions: number; engagement: number }> {
  const periodParams = { period: "day", since, until };

  // reach supports time_series; views + accounts_engaged require metric_type=total_value (IG API v22+).
  const [reachRes, totalValueRes] = await Promise.all([
    graphGet<{ data?: IgInsightMetricRow[] }>(
      graphUrl(`${igUserId}/insights`, {
        ...periodParams,
        metric: "reach",
        metric_type: "time_series",
      }),
      accessToken,
    ),
    graphGet<{ data?: IgInsightMetricRow[] }>(
      graphUrl(`${igUserId}/insights`, {
        ...periodParams,
        metric: "views,accounts_engaged",
        metric_type: "total_value",
      }),
      accessToken,
    ),
  ]);

  const sums: Record<string, number> = { reach: 0, views: 0, accounts_engaged: 0 };
  for (const metric of reachRes.data ?? []) {
    if (String(metric.name ?? "") === "reach") {
      sums.reach = parseIgInsightMetricValue(metric);
    }
  }
  for (const metric of totalValueRes.data ?? []) {
    const name = String(metric.name ?? "");
    sums[name] = parseIgInsightMetricValue(metric);
  }

  return {
    reach: sums.reach ?? 0,
    impressions: sums.views ?? 0,
    engagement: sums.accounts_engaged ?? 0,
  };
}

export async function fetchInstagramMediaInsights(
  mediaId: string,
  accessToken: string,
): Promise<{ reach: number; impressions: number; engagement: number }> {
  try {
    const data = await graphGet<{ data?: IgInsightMetricRow[] }>(
      graphUrl(`${mediaId}/insights`, {
        metric: "reach,views,total_interactions",
        metric_type: "total_value",
      }),
      accessToken,
    );
    const out: Record<string, number> = {};
    for (const metric of data.data ?? []) {
      out[String(metric.name ?? "")] = parseIgInsightMetricValue(metric);
    }
    return {
      reach: out.reach ?? 0,
      impressions: out.views ?? out.impressions ?? 0,
      engagement: out.total_interactions ?? out.engagement ?? 0,
    };
  } catch {
    return { reach: 0, impressions: 0, engagement: 0 };
  }
}

export async function fetchFacebookPageInsights(
  pageId: string,
  accessToken: string,
  since: string,
  until: string,
): Promise<{ reach: number; impressions: number; engagement: number }> {
  const periodParams = { period: "day", since, until };
  // page_impressions + page_engaged_users were deprecated (Nov 2025); use media view + engagement metrics.
  const data = await graphGet<{ data?: FbInsightMetricRow[] }>(
    graphUrl(`${pageId}/insights`, {
      ...periodParams,
      metric: "page_media_view,page_total_media_view_unique,page_post_engagements",
    }),
    accessToken,
  );
  const sums: Record<string, number> = {};
  for (const metric of data.data ?? []) {
    sums[String(metric.name ?? "")] = parseFbInsightMetricValue(metric);
  }
  return {
    reach: sums.page_total_media_view_unique ?? 0,
    impressions: sums.page_media_view ?? 0,
    engagement: sums.page_post_engagements ?? 0,
  };
}

export async function fetchFacebookPostInsights(
  postId: string,
  accessToken: string,
  inline?: { insight_views?: number; insight_reach?: number },
): Promise<{ reach: number; impressions: number; engagement: number }> {
  const hasInlineViews = inline?.insight_views != null && inline.insight_views > 0;
  const hasInlineReach = inline?.insight_reach != null && inline.insight_reach > 0;
  if (hasInlineViews && hasInlineReach) {
    return {
      reach: inline!.insight_reach!,
      impressions: inline!.insight_views!,
      engagement: 0,
    };
  }

  const metricSets: Array<Record<string, string>> = [
    { metric: "post_media_view,post_total_media_view_unique", period: "lifetime" },
    { metric: "post_impressions,post_impressions_unique", period: "lifetime" },
    { metric: "post_media_view,post_total_media_view_unique", date_preset: "maximum" },
  ];

  for (const params of metricSets) {
    try {
      const data = await graphGet<{ data?: FbInsightMetricRow[] }>(
        graphUrl(`${postId}/insights`, params as Record<string, string>),
        accessToken,
      );
      const out: Record<string, number> = {};
      for (const row of data.data ?? []) {
        out[String(row.name ?? "")] = parseFbInsightMetricValue(row);
      }
      const views = out.post_media_view ?? out.post_impressions ?? inline?.insight_views ?? 0;
      const reach = out.post_total_media_view_unique ?? out.post_impressions_unique ?? inline?.insight_reach ?? 0;
      if (views > 0 || reach > 0) {
        return { reach, impressions: views, engagement: 0 };
      }
    } catch {
      // try next metric set
    }
  }

  return {
    reach: inline?.insight_reach ?? 0,
    impressions: inline?.insight_views ?? 0,
    engagement: 0,
  };
}

/** Summary metrics must match the visible post table (single source of truth). */
export function buildMetaContentSummaryFromPosts(
  postRows: Array<{
    view_count: number;
    like_count: number;
    comment_count: number;
    reach: number;
  }>,
): {
  reach: number;
  views: number;
  engagement: number;
  totalLikes: number;
  totalComments: number;
} {
  const totalLikes = postRows.reduce((s, p) => s + p.like_count, 0);
  const totalComments = postRows.reduce((s, p) => s + p.comment_count, 0);
  let views = postRows.reduce((s, p) => s + p.view_count, 0);
  let reach = postRows.reduce((s, p) => s + p.reach, 0);
  const engagement = totalLikes + totalComments;

  if (reach > 0 && views < reach) views = reach;

  return { reach, views, engagement, totalLikes, totalComments };
}

/** @deprecated Use buildMetaContentSummaryFromPosts */
export const buildFacebookSummaryFromPosts = buildMetaContentSummaryFromPosts;

export function computeMetaEngagementRate(
  likes: number,
  comments: number,
  views: number,
): number | null {
  if (!Number.isFinite(views) || views <= 0) return null;
  const rate = ((likes + comments) / views) * 100;
  if (!Number.isFinite(rate)) return null;
  return rate;
}

export async function fetchMetaPosts(
  platform: MetaContentPlatform,
  account: { pageId: string; igBusinessAccountId: string | null; pageAccessToken: string },
  limit?: number,
): Promise<MetaContentPost[]> {
  if (platform === "instagram" && account.igBusinessAccountId) {
    return fetchInstagramMedia(account.igBusinessAccountId, account.pageAccessToken, limit);
  }
  return fetchFacebookPosts(account.pageId, account.pageAccessToken, limit);
}

export async function fetchMetaComments(
  platform: MetaContentPlatform,
  mediaId: string,
  accessToken: string,
): Promise<MetaContentComment[]> {
  if (platform === "instagram") {
    return fetchInstagramComments(mediaId, accessToken);
  }
  return fetchFacebookComments(mediaId, accessToken);
}

export async function replyMetaComment(
  platform: MetaContentPlatform,
  commentId: string,
  text: string,
  accessToken: string,
): Promise<{ id: string }> {
  if (platform === "instagram") {
    return replyInstagramComment(commentId, text, accessToken);
  }
  return replyFacebookComment(commentId, text, accessToken);
}
