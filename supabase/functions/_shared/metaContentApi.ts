import type { MetaContentPlatform } from "./metaContentAuth.ts";
import { graphUrl } from "./metaContentAuth.ts";
import { metaGraphVersion } from "./metaPlatformScopes.ts";

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
  /** Instagram surface: FEED | REELS | STORY | … (from media_product_type). */
  media_product_type?: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
  comment_count: number;
  like_count: number;
  shares_count?: number;
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

const GRAPH_BATCH_LIMIT = 50;
const GRAPH_BATCH_RETRY_CHUNK = 10;
/** Keep low — many sequential passes previously burned the edge worker (~150s → 546). */
const GRAPH_BATCH_INTER_CHUNK_DELAY_MS = 50;

type GraphBatchItemResult = { code: number; body: string };

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGraphBatchItemSuccess(item: GraphBatchItemResult | undefined): boolean {
  return Boolean(item && item.code >= 200 && item.code < 300);
}

async function graphBatchGet(
  accessToken: string,
  relativeUrls: string[],
): Promise<GraphBatchItemResult[]> {
  if (relativeUrls.length === 0) return [];
  const version = metaGraphVersion();
  const url = `https://graph.facebook.com/${version}/`;
  const batchPayload = relativeUrls.map((relative_url) => ({
    method: "GET",
    relative_url,
  }));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: accessToken,
      batch: JSON.stringify(batchPayload),
    }).toString(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Graph batch error ${res.status}`);
  }
  return Array.isArray(data) ? (data as GraphBatchItemResult[]) : [];
}

async function graphBatchGetResilient(
  accessToken: string,
  relativeUrls: string[],
): Promise<GraphBatchItemResult[]> {
  const attempts = 2;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const results = await graphBatchGet(accessToken, relativeUrls);
      if (results.length === relativeUrls.length) return results;
    } catch (err) {
      if (attempt === attempts - 1) {
        console.warn(
          "graphBatchGetResilient failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }
    await sleepMs(GRAPH_BATCH_INTER_CHUNK_DELAY_MS * (attempt + 1));
  }
  return relativeUrls.map(() => ({ code: 0, body: "" }));
}

function igInsightsRelativeUrl(mediaId: string, params: Record<string, string>): string {
  return `${mediaId}/insights?${new URLSearchParams(params).toString()}`;
}

function isInstagramReelsMedia(
  mediaType: string | null | undefined,
  mediaProductType?: string | null,
): boolean {
  const type = String(mediaType ?? "").toUpperCase();
  const product = String(mediaProductType ?? "").toUpperCase();
  return type === "REELS" || product === "REELS" || product === "REEL";
}

/** Prefer metrics that match the Instagram app (total_views > organic views > legacy). */
function resolveInstagramMediaViewCount(
  merged: Record<string, number>,
  fieldViews = 0,
): number {
  const totalViews = Number(merged.total_views ?? 0) || 0;
  const views = Number(merged.views ?? 0) || 0;
  const crossposted = Number(merged.crossposted_views ?? 0) || 0;
  const modern = Math.max(totalViews, views, crossposted, Number(fieldViews) || 0);
  if (modern > 0) return modern;
  // Legacy impressions only when modern views are unavailable (pre-July 2024 media).
  return Number(merged.impressions ?? 0) || 0;
}

/** Instagram Professional Dashboard "Views" = average of the last N posts. */
export function averageInstagramViewsLastN(
  posts: Array<{ view_count: number; posted_at?: string | null }>,
  n = 3,
): number {
  if (!posts.length || n <= 0) return 0;
  const sorted = [...posts].sort((a, b) => {
    const ta = a.posted_at ? Date.parse(a.posted_at) : 0;
    const tb = b.posted_at ? Date.parse(b.posted_at) : 0;
    return tb - ta;
  });
  const slice = sorted.slice(0, Math.min(n, sorted.length));
  const sum = slice.reduce((acc, p) => acc + (Number(p.view_count) || 0), 0);
  return Math.round(sum / slice.length);
}

function hasResolvedInstagramViews(merged: Record<string, number>): boolean {
  return resolveInstagramMediaViewCount(merged) > 0;
}

function parseBatchInsightBody(body: string): Record<string, number> {
  try {
    const parsed = JSON.parse(body) as { data?: IgInsightMetricRow[] };
    return parseIgInsightMetrics(parsed.data);
  } catch {
    return {};
  }
}

function parseBatchMediaViewFieldsBody(body: string): number {
  try {
    const parsed = JSON.parse(body) as {
      view_count?: number;
      views_count?: number;
      total_views_count?: number;
      error?: { message?: string };
    };
    if (parsed.error) return 0;
    // Prefer total_views_count (matches Instagram app / boosted). Do not require view_count —
    // requesting view_count outside Business Discovery fails the whole fields call.
    return Number(parsed.total_views_count ?? parsed.views_count ?? parsed.view_count ?? 0) || 0;
  } catch {
    return 0;
  }
}

async function mergeIgInsightBatchPass(
  posts: MetaContentPost[],
  accessToken: string,
  mergedById: Map<string, Record<string, number>>,
  relativeUrlForPost: (post: MetaContentPost) => string,
): Promise<void> {
  const failedPosts: MetaContentPost[] = [];

  for (let i = 0; i < posts.length; i += GRAPH_BATCH_LIMIT) {
    if (i > 0) await sleepMs(GRAPH_BATCH_INTER_CHUNK_DELAY_MS);
    const chunk = posts.slice(i, i + GRAPH_BATCH_LIMIT);
    const batchResults = await graphBatchGetResilient(
      accessToken,
      chunk.map(relativeUrlForPost),
    );
    chunk.forEach((post, idx) => {
      const item = batchResults[idx];
      if (!isGraphBatchItemSuccess(item)) {
        failedPosts.push(post);
        return;
      }
      const parsed = parseBatchInsightBody(item.body);
      mergedById.set(post.id, { ...(mergedById.get(post.id) ?? {}), ...parsed });
    });
  }

  for (let i = 0; i < failedPosts.length; i += GRAPH_BATCH_RETRY_CHUNK) {
    await sleepMs(GRAPH_BATCH_INTER_CHUNK_DELAY_MS);
    const chunk = failedPosts.slice(i, i + GRAPH_BATCH_RETRY_CHUNK);
    const batchResults = await graphBatchGetResilient(
      accessToken,
      chunk.map(relativeUrlForPost),
    );
    chunk.forEach((post, idx) => {
      const item = batchResults[idx];
      if (!isGraphBatchItemSuccess(item)) return;
      const parsed = parseBatchInsightBody(item.body);
      mergedById.set(post.id, { ...(mergedById.get(post.id) ?? {}), ...parsed });
    });
  }
}

async function mergeIgMediaViewFieldsBatchPass(
  posts: MetaContentPost[],
  accessToken: string,
  viewCountById: Map<string, number>,
): Promise<void> {
  for (let i = 0; i < posts.length; i += GRAPH_BATCH_LIMIT) {
    if (i > 0) await sleepMs(GRAPH_BATCH_INTER_CHUNK_DELAY_MS);
    const chunk = posts.slice(i, i + GRAPH_BATCH_LIMIT);
    const batchResults = await graphBatchGetResilient(
      accessToken,
      // Only total_views_count — view_count is Business Discovery-only and fails the whole request.
      chunk.map((post) => `${post.id}?fields=total_views_count`),
    );
    chunk.forEach((post, idx) => {
      const item = batchResults[idx];
      if (!isGraphBatchItemSuccess(item)) return;
      const views = parseBatchMediaViewFieldsBody(item.body);
      if (views > 0) viewCountById.set(post.id, views);
    });
  }
}

async function fetchInstagramMediaInsightsSingleMerged(
  mediaId: string,
  accessToken: string,
  mediaType?: string | null,
  mediaProductType?: string | null,
): Promise<Record<string, number>> {
  const merged: Record<string, number> = {};
  const isReels = isInstagramReelsMedia(mediaType, mediaProductType);

  Object.assign(
    merged,
    await fetchIgMediaInsightMetrics(mediaId, accessToken, {
      metric: "reach,views,total_views,total_interactions,shares,saved",
      metric_type: "total_value",
    }),
  );

  if (isReels) {
    Object.assign(
      merged,
      await fetchIgMediaInsightMetrics(mediaId, accessToken, {
        metric: "ig_reels_avg_watch_time",
        metric_type: "total_value",
      }),
    );
  }

  if (!hasResolvedInstagramViews(merged)) {
    Object.assign(
      merged,
      await fetchIgMediaInsightMetrics(mediaId, accessToken, {
        metric: "impressions",
        period: "lifetime",
      }),
    );
  }

  if (!hasResolvedInstagramViews(merged) && !isReels) {
    Object.assign(
      merged,
      await fetchIgMediaInsightMetrics(mediaId, accessToken, {
        metric: "impressions,reach,engagement",
        period: "lifetime",
      }),
    );
  }

  if (!hasResolvedInstagramViews(merged)) {
    const fieldViews = await fetchInstagramMediaViewCountFromFields(mediaId, accessToken);
    if (fieldViews > 0) merged.views = fieldViews;
  }

  return merged;
}

async function fetchInstagramMediaInsightsMap(
  posts: MetaContentPost[],
  accessToken: string,
): Promise<Map<string, InstagramMediaInsights>> {
  const mergedById = new Map<string, Record<string, number>>();
  for (const post of posts) mergedById.set(post.id, {});

  if (posts.length === 0) return new Map();

  const nonReels = posts.filter(
    (post) => !isInstagramReelsMedia(post.media_type, post.media_product_type),
  );
  const reelsOnly = posts.filter((post) =>
    isInstagramReelsMedia(post.media_type, post.media_product_type),
  );

  // One primary pass: views + engagement + saved (FEED & REELS). Avoid many sequential rounds.
  await mergeIgInsightBatchPass(posts, accessToken, mergedById, (post) =>
    igInsightsRelativeUrl(post.id, {
      metric: "reach,views,total_views,total_interactions,shares,saved",
      metric_type: "total_value",
    }));

  // Reels-only avg watch time (unsupported on FEED — keep separate).
  await mergeIgInsightBatchPass(reelsOnly, accessToken, mergedById, (post) =>
    igInsightsRelativeUrl(post.id, {
      metric: "ig_reels_avg_watch_time",
      metric_type: "total_value",
    }));

  // Legacy impressions only for posts still missing modern views.
  const needImpressions = posts.filter(
    (post) => !hasResolvedInstagramViews(mergedById.get(post.id) ?? {}),
  );
  if (needImpressions.length > 0) {
    await mergeIgInsightBatchPass(needImpressions, accessToken, mergedById, (post) =>
      igInsightsRelativeUrl(post.id, { metric: "impressions", period: "lifetime" }));
  }

  const needLegacyBundle = nonReels.filter(
    (post) => !hasResolvedInstagramViews(mergedById.get(post.id) ?? {}),
  );
  if (needLegacyBundle.length > 0) {
    await mergeIgInsightBatchPass(needLegacyBundle, accessToken, mergedById, (post) =>
      igInsightsRelativeUrl(post.id, {
        metric: "impressions,reach,engagement",
        period: "lifetime",
      }));
  }

  // total_views_count field only when views still unresolved (not for every post).
  const viewCountById = new Map<string, number>();
  const needViewFields = posts.filter(
    (post) => !hasResolvedInstagramViews(mergedById.get(post.id) ?? {}),
  );
  if (needViewFields.length > 0) {
    await mergeIgMediaViewFieldsBatchPass(needViewFields, accessToken, viewCountById);
    for (const post of needViewFields) {
      const fieldViews = viewCountById.get(post.id) ?? 0;
      if (fieldViews <= 0) continue;
      const merged = mergedById.get(post.id) ?? {};
      if ((merged.total_views ?? 0) < fieldViews) {
        merged.total_views = fieldViews;
        mergedById.set(post.id, merged);
      }
    }
  }

  // Last resort: individual fetch only for unresolved views.
  // Hard-cap to avoid WORKER_RESOURCE_LIMIT on large all-time syncs.
  const needIndividual = posts
    .filter((post) => {
      const merged = mergedById.get(post.id) ?? {};
      return resolveInstagramMediaViewCount(merged, viewCountById.get(post.id) ?? 0) === 0;
    })
    .slice(0, 25);
  if (needIndividual.length > 0) {
    await mapWithConcurrency(needIndividual, 3, async (post) => {
      const merged = await fetchInstagramMediaInsightsSingleMerged(
        post.id,
        accessToken,
        post.media_type,
        post.media_product_type,
      );
      mergedById.set(post.id, { ...(mergedById.get(post.id) ?? {}), ...merged });
    });
  }

  const out = new Map<string, InstagramMediaInsights>();
  for (const post of posts) {
    const merged = mergedById.get(post.id) ?? {};
    const views = resolveInstagramMediaViewCount(merged, viewCountById.get(post.id) ?? 0);
    const isReels = isInstagramReelsMedia(post.media_type, post.media_product_type);
    out.set(post.id, {
      reach: merged.reach ?? 0,
      views,
      total_interactions: merged.total_interactions ?? merged.engagement ?? 0,
      shares: merged.shares ?? 0,
      save_count: Object.prototype.hasOwnProperty.call(merged, "saved")
        ? Number(merged.saved) || 0
        : null,
      avg_watch_time_ms: isReels && Object.prototype.hasOwnProperty.call(merged, "ig_reels_avg_watch_time")
        ? Number(merged.ig_reels_avg_watch_time) || 0
        : null,
    });
  }
  return out;
}

/** Cap keeps insights enrichment under the edge worker resource limit (~150s). */
export const META_CONTENT_ALL_TIME_MAX_POSTS = 250;
export const META_CONTENT_ALL_TIME_MAX_PAGES = 20;
export const META_CONTENT_DATED_MAX_POSTS = 50;

const IG_MEDIA_LIST_FIELDS =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count,shares_count";

export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
  limit = 25,
): Promise<MetaContentPost[]> {
  const url = graphUrl(`${igUserId}/media`, {
    fields: IG_MEDIA_LIST_FIELDS,
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });
  const data = await graphGet<{ data?: Array<Record<string, unknown>> }>(url, accessToken);
  return (data.data ?? []).map(mapIgMedia);
}

export type ResolveInstagramPostsOptions = {
  /** Paginate through entire publish history (no publish-date filter). */
  allTime?: boolean;
};

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
 * Fetches IG media with cursor pagination.
 * - `allTime`: all published posts up to {@link META_CONTENT_ALL_TIME_MAX_POSTS}.
 * - `dateRange`: posts whose publish date falls in [startYmd, endYmd] up to `limit`.
 */
export async function resolveInstagramPostsForMetrics(
  igUserId: string,
  accessToken: string,
  limit: number,
  dateRange?: { startYmd: string; endYmd: string },
  options?: ResolveInstagramPostsOptions,
): Promise<MetaContentPost[]> {
  const filterByDate = Boolean(
    dateRange?.startYmd && dateRange?.endYmd && !options?.allTime,
  );
  const paginate = filterByDate || options?.allTime === true;

  if (!paginate) {
    return fetchInstagramMedia(igUserId, accessToken, limit);
  }

  const { startYmd, endYmd } = dateRange ?? { startYmd: "", endYmd: "" };
  const inRange: MetaContentPost[] = [];
  let after: string | undefined;
  const maxPages = options?.allTime ? META_CONTENT_ALL_TIME_MAX_PAGES : 25;
  const cap = options?.allTime ? META_CONTENT_ALL_TIME_MAX_POSTS : limit;

  for (let page = 0; page < maxPages && inRange.length < cap; page++) {
    const params: Record<string, string> = {
      fields: IG_MEDIA_LIST_FIELDS,
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
      if (filterByDate) {
        if (!post.timestamp) continue;
        const ymd = timestampToUtcYmd(post.timestamp);
        if (!ymd || ymd < startYmd || ymd > endYmd) continue;
      }
      inRange.push(post);
      if (inRange.length >= cap) break;
    }

    if (filterByDate && startYmd) {
      const oldest = batch[batch.length - 1];
      const oldestYmd = oldest?.timestamp ? timestampToUtcYmd(oldest.timestamp) : "";
      if (oldestYmd && oldestYmd < startYmd) break;
    }

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

async function fetchFacebookPostShareCount(postId: string, accessToken: string): Promise<number> {
  try {
    const row = await graphGet<{ shares?: { count?: number } }>(
      graphUrl(postId, { fields: "shares" }),
      accessToken,
    );
    return Number(row.shares?.count ?? 0) || 0;
  } catch {
    return 0;
  }
}

type FbPostHydratedMetrics = {
  like_count: number;
  comment_count: number;
  view_count: number;
  reach: number;
  share_count: number;
  total_interactions: number;
};

function parseBatchFbPostFieldsBody(body: string): Pick<
  FbPostHydratedMetrics,
  "like_count" | "comment_count" | "share_count"
> {
  try {
    const row = JSON.parse(body) as Record<string, unknown>;
    const mapped = mapFbPost({ ...row, id: String(row.id ?? "") });
    return {
      like_count: mapped.like_count,
      comment_count: mapped.comment_count,
      share_count: mapped.shares_count ?? 0,
    };
  } catch {
    return { like_count: 0, comment_count: 0, share_count: 0 };
  }
}

function parseBatchFbInsightBody(body: string): Record<string, number> {
  try {
    const parsed = JSON.parse(body) as { data?: FbInsightMetricRow[] };
    const out: Record<string, number> = {};
    for (const metric of parsed.data ?? []) {
      out[String(metric.name ?? "")] = parseFbInsightMetricValue(metric);
    }
    return out;
  } catch {
    return {};
  }
}

function applyFbInsightMetrics(
  metrics: FbPostHydratedMetrics,
  insight: Record<string, number>,
): void {
  const views = insight.post_media_view ?? insight.post_impressions ?? 0;
  const reach = insight.post_total_media_view_unique ?? insight.post_impressions_unique ?? 0;
  if (views > 0) metrics.view_count = Math.max(metrics.view_count, views);
  if (reach > 0) metrics.reach = Math.max(metrics.reach, reach);
  const engaged = insight.post_engaged_users ?? 0;
  if (engaged > 0) metrics.total_interactions = Math.max(metrics.total_interactions, engaged);
}

async function mergeFbPostFieldsBatchPass(
  posts: MetaContentPost[],
  accessToken: string,
  metricsById: Map<string, FbPostHydratedMetrics>,
): Promise<void> {
  for (let i = 0; i < posts.length; i += GRAPH_BATCH_LIMIT) {
    if (i > 0) await sleepMs(GRAPH_BATCH_INTER_CHUNK_DELAY_MS);
    const chunk = posts.slice(i, i + GRAPH_BATCH_LIMIT);
    const batchResults = await graphBatchGetResilient(
      accessToken,
      chunk.map((post) => `${post.id}?fields=reactions.summary(true),comments.summary(true),shares`),
    );
    chunk.forEach((post, idx) => {
      const item = batchResults[idx];
      if (!isGraphBatchItemSuccess(item)) return;
      const parsed = parseBatchFbPostFieldsBody(item.body);
      const current = metricsById.get(post.id);
      if (!current) return;
      current.like_count = Math.max(current.like_count, parsed.like_count);
      current.comment_count = Math.max(current.comment_count, parsed.comment_count);
      current.share_count = Math.max(current.share_count, parsed.share_count);
    });
  }
}

async function mergeFbInsightsBatchPass(
  posts: MetaContentPost[],
  accessToken: string,
  metricsById: Map<string, FbPostHydratedMetrics>,
  params: Record<string, string>,
): Promise<void> {
  for (let i = 0; i < posts.length; i += GRAPH_BATCH_LIMIT) {
    if (i > 0) await sleepMs(GRAPH_BATCH_INTER_CHUNK_DELAY_MS);
    const chunk = posts.slice(i, i + GRAPH_BATCH_LIMIT);
    const batchResults = await graphBatchGetResilient(
      accessToken,
      chunk.map((post) => `${post.id}/insights?${new URLSearchParams(params).toString()}`),
    );
    chunk.forEach((post, idx) => {
      const item = batchResults[idx];
      if (!isGraphBatchItemSuccess(item)) return;
      const current = metricsById.get(post.id);
      if (!current) return;
      applyFbInsightMetrics(current, parseBatchFbInsightBody(item.body));
    });
  }
}

async function fetchFacebookPostMetricsMap(
  posts: MetaContentPost[],
  accessToken: string,
): Promise<Map<string, FbPostHydratedMetrics>> {
  const metricsById = new Map<string, FbPostHydratedMetrics>();
  for (const post of posts) {
    metricsById.set(post.id, {
      like_count: post.like_count,
      comment_count: post.comment_count,
      view_count: post.insight_views ?? 0,
      reach: post.insight_reach ?? 0,
      share_count: post.shares_count ?? 0,
      total_interactions: 0,
    });
  }
  if (posts.length === 0) return metricsById;

  await mergeFbPostFieldsBatchPass(posts, accessToken, metricsById);

  const needInsights = () => posts.filter((post) => {
    const metrics = metricsById.get(post.id);
    return !metrics || metrics.view_count === 0 || metrics.reach === 0;
  });

  await mergeFbInsightsBatchPass(needInsights(), accessToken, metricsById, {
    metric: "post_media_view,post_total_media_view_unique,post_engaged_users",
    period: "lifetime",
  });
  await mergeFbInsightsBatchPass(needInsights(), accessToken, metricsById, {
    metric: "post_impressions,post_impressions_unique,post_engaged_users",
    period: "lifetime",
  });
  await mergeFbInsightsBatchPass(needInsights(), accessToken, metricsById, {
    metric: "post_media_view,post_total_media_view_unique",
    date_preset: "maximum",
  });

  for (const post of posts) {
    const metrics = metricsById.get(post.id);
    if (!metrics) continue;
    if (metrics.reach > 0 && metrics.view_count < metrics.reach) {
      metrics.view_count = metrics.reach;
    }
    if (metrics.total_interactions === 0) {
      metrics.total_interactions = metrics.like_count + metrics.comment_count + metrics.share_count;
    }
  }

  return metricsById;
}

export async function hydrateFacebookPostMetrics(
  post: MetaContentPost,
  accessToken: string,
): Promise<{ like_count: number; comment_count: number; view_count: number; reach: number; share_count: number }> {
  const map = await fetchFacebookPostMetricsMap([post], accessToken);
  const metrics = map.get(post.id) ?? {
    like_count: post.like_count,
    comment_count: post.comment_count,
    view_count: post.insight_views ?? 0,
    reach: post.insight_reach ?? 0,
    share_count: post.shares_count ?? 0,
    total_interactions: 0,
  };
  return {
    like_count: metrics.like_count,
    comment_count: metrics.comment_count,
    view_count: metrics.view_count,
    reach: metrics.reach,
    share_count: metrics.share_count,
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
  /** Meta insights `total_interactions` (or legacy `engagement`) — not derived from likes/comments. */
  total_interactions: number;
  engagement_rate: number | null;
  /** Instagram Reels `ig_reels_avg_watch_time` in milliseconds; null when unavailable. */
  avg_watch_time_ms: number | null;
  /** Instagram media `saved` insight; null when unavailable (e.g. Facebook). */
  save_count: number | null;
  caption: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
};

export async function buildFacebookMetricsPostRows(
  posts: MetaContentPost[],
  accessToken: string,
  accountId: string,
): Promise<FacebookMetricsPostRow[]> {
  const metricsMap = await fetchFacebookPostMetricsMap(posts, accessToken);
  return posts.map((p) => {
    const m = metricsMap.get(p.id) ?? {
      like_count: p.like_count,
      comment_count: p.comment_count,
      view_count: p.insight_views ?? 0,
      reach: p.insight_reach ?? 0,
      share_count: p.shares_count ?? 0,
      total_interactions: 0,
    };
    return {
      platform: "facebook",
      account_id: accountId,
      content_id: p.id,
      posted_at: p.timestamp,
      view_count: m.view_count,
      like_count: m.like_count,
      comment_count: m.comment_count,
      share_count: m.share_count,
      reach: m.reach,
      total_interactions: m.total_interactions,
      engagement_rate: computeInstagramEngagementRateFromApi(m.total_interactions, m.view_count)
        ?? computeMetaEngagementRate(m.like_count, m.comment_count, m.view_count, m.share_count),
      avg_watch_time_ms: null,
      save_count: null,
      caption: p.caption,
      media_url: p.media_url ?? p.thumbnail_url,
      thumbnail_url: p.thumbnail_url ?? p.media_url,
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
  const insightsMap = await fetchInstagramMediaInsightsMap(posts, accessToken);
  return posts.map((p) => {
    const mediaInsights = insightsMap.get(p.id) ?? {
      reach: 0,
      views: 0,
      total_interactions: 0,
      shares: 0,
      save_count: null,
      avg_watch_time_ms: null,
    };
    const viewCount = mediaInsights.views;
    const likeCount = p.like_count;
    const commentCount = p.comment_count;
    const shareCount = Math.max(p.shares_count ?? 0, mediaInsights.shares);
    const totalInteractions = mediaInsights.total_interactions;
    return {
      platform: "instagram",
      account_id: accountId,
      content_id: p.id,
      posted_at: p.timestamp,
      view_count: viewCount,
      like_count: likeCount,
      comment_count: commentCount,
      share_count: shareCount,
      reach: mediaInsights.reach,
      total_interactions: totalInteractions,
      engagement_rate: computeInstagramEngagementRateFromApi(totalInteractions, viewCount),
      avg_watch_time_ms: mediaInsights.avg_watch_time_ms,
      save_count: mediaInsights.save_count,
      caption: p.caption,
      media_url: pickInstagramPostPreviewUrl(p),
      thumbnail_url: pickInstagramPostPreviewUrl(p),
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
  "shares",
  "comments.summary(true)",
  "reactions.summary(true)",
].join(",");

async function fetchFacebookPostsFromEndpoint(
  endpoint: string,
  accessToken: string,
  limit: number,
  dateRange?: { startYmd: string; endYmd: string },
  options?: { allTime?: boolean },
): Promise<{ posts: MetaContentPost[]; sawAnyBatch: boolean }> {
  const filterByDate = Boolean(
    dateRange?.startYmd && dateRange?.endYmd && !options?.allTime,
  );
  const paginate = filterByDate || options?.allTime === true;
  const inRange: MetaContentPost[] = [];
  let after: string | undefined;
  const maxPages = options?.allTime ? META_CONTENT_ALL_TIME_MAX_PAGES : filterByDate ? 25 : 1;
  const cap = options?.allTime ? META_CONTENT_ALL_TIME_MAX_POSTS : limit;
  let sawAnyBatch = false;

  for (let page = 0; page < maxPages && inRange.length < cap; page++) {
    const params: Record<string, string> = {
      fields: FB_POST_LIST_FIELDS,
      limit: paginate ? "50" : String(Math.min(Math.max(limit, 1), 100)),
    };
    if (after) params.after = after;

    const data = await graphGet<{
      data?: Array<Record<string, unknown>>;
      paging?: { cursors?: { after?: string } };
    }>(graphUrl(endpoint, params), accessToken);

    const batch = (data.data ?? []).map(mapFbPost);
    if (batch.length === 0) break;
    sawAnyBatch = true;

    if (!paginate) {
      return { posts: batch.slice(0, limit), sawAnyBatch: true };
    }

    const { startYmd = "", endYmd = "" } = dateRange ?? {};
    for (const post of batch) {
      if (filterByDate) {
        if (!post.timestamp) continue;
        const ymd = timestampToUtcYmd(post.timestamp);
        if (!ymd || ymd < startYmd || ymd > endYmd) continue;
      }
      inRange.push(post);
      if (inRange.length >= cap) break;
    }

    if (filterByDate && startYmd) {
      const oldest = batch[batch.length - 1];
      const oldestYmd = oldest?.timestamp ? timestampToUtcYmd(oldest.timestamp) : "";
      if (oldestYmd && oldestYmd < startYmd) break;
    }

    after = data.paging?.cursors?.after;
    if (!after) break;
  }

  return { posts: inRange, sawAnyBatch };
}

export type ResolveFacebookPostsOptions = {
  allTime?: boolean;
};

/**
 * Fetches Facebook page posts, optionally paginating until enough posts fall in the YMD range.
 */
export async function resolveFacebookPostsForMetrics(
  pageId: string,
  accessToken: string,
  limit: number,
  dateRange?: { startYmd: string; endYmd: string },
  options?: ResolveFacebookPostsOptions,
): Promise<MetaContentPost[]> {
  const listEndpoints = [
    `${pageId}/published_posts`,
    `${pageId}/posts`,
    `${pageId}/feed`,
  ];

  for (const endpoint of listEndpoints) {
    try {
      const { posts, sawAnyBatch } = await fetchFacebookPostsFromEndpoint(
        endpoint,
        accessToken,
        limit,
        dateRange,
        options,
      );
      if (posts.length > 0) return posts;
      if (sawAnyBatch) return [];
    } catch (err) {
      console.warn(`resolveFacebookPostsForMetrics ${endpoint}:`, err instanceof Error ? err.message : err);
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

function looksLikeVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) || /\/video\//i.test(url);
}

/** URL suitable for <img> preview — Reels/VIDEO must use thumbnail, not MP4 media_url. */
export function pickInstagramPostPreviewUrl(
  p: Pick<MetaContentPost, "media_type" | "media_url" | "thumbnail_url">,
): string | null {
  const thumb = p.thumbnail_url?.trim() || null;
  const media = p.media_url?.trim() || null;
  const type = (p.media_type ?? "").toUpperCase();

  if (type === "VIDEO" || type === "REELS" || type === "STORY") {
    return thumb;
  }
  if (media && looksLikeVideoUrl(media)) {
    return thumb;
  }
  return media ?? thumb;
}

function mapIgMedia(row: Record<string, unknown>): MetaContentPost {
  return {
    id: String(row.id ?? ""),
    caption: typeof row.caption === "string" ? row.caption : null,
    media_type: typeof row.media_type === "string" ? row.media_type : null,
    media_product_type: typeof row.media_product_type === "string" ? row.media_product_type : null,
    media_url: typeof row.media_url === "string" ? row.media_url : null,
    thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    permalink: typeof row.permalink === "string" ? row.permalink : null,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
    comment_count: Number(row.comments_count ?? 0),
    like_count: Number(row.like_count ?? 0),
    shares_count: Number(row.shares_count ?? 0) || 0,
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
  const shares = row.shares as { count?: number } | undefined;
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
    shares_count: Number(shares?.count ?? 0) || 0,
    insight_views: inline.views > 0 ? inline.views : undefined,
    insight_reach: inline.reach > 0 ? inline.reach : undefined,
  };
}

export type MetaMediaPreview = {
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
};

/** Fetch caption/thumbnail for a single IG or FB post by media/post id. */
export async function fetchMetaMediaPreviewById(
  mediaId: string,
  platform: MetaContentPlatform,
  accessToken: string,
): Promise<MetaMediaPreview | null> {
  const id = mediaId.trim();
  if (!id) return null;
  try {
    if (platform === "instagram") {
      const data = await graphGet<Record<string, unknown>>(
        graphUrl(id, { fields: "caption,media_type,media_url,thumbnail_url,permalink" }),
        accessToken,
      );
      const post = mapIgMedia(data);
      return {
        caption: post.caption,
        thumbnail_url: pickInstagramPostPreviewUrl(post),
        permalink: post.permalink,
      };
    }
    const data = await graphGet<Record<string, unknown>>(
      graphUrl(id, { fields: "message,full_picture,permalink_url" }),
      accessToken,
    );
    const post = mapFbPost(data);
    return {
      caption: post.caption,
      thumbnail_url: post.thumbnail_url ?? post.media_url,
      permalink: post.permalink,
    };
  } catch (err) {
    console.warn("[metaContent] fetchMetaMediaPreviewById failed:", id, platform, err);
    return null;
  }
}

export async function fetchInstagramComments(
  mediaId: string,
  accessToken: string,
): Promise<MetaContentComment[]> {
  const fields = "id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}";
  const url = graphUrl(`${mediaId}/comments`, { fields });
  const data = await graphGet<{ data?: Array<Record<string, unknown>> }>(url, accessToken);
  const topLevel = (data.data ?? []).flatMap((row) => {
    const parentId = String(row.id ?? "");
    const replies = row.replies as { data?: Array<Record<string, unknown>> } | undefined;
    const replyRows = (replies?.data ?? []).map((r) => mapIgComment(r, mediaId, parentId));
    const parent = mapIgComment(row, mediaId, null, replyRows.length);
    return [parent, ...replyRows];
  });
  return topLevel;
}

function mapIgComment(
  row: Record<string, unknown>,
  mediaId: string,
  parentId: string | null,
  replyCount = 0,
): MetaContentComment {
  return {
    id: String(row.id ?? ""),
    media_id: mediaId,
    text: typeof row.text === "string" ? row.text : "",
    author_name: typeof row.username === "string" ? row.username : "Unknown",
    author_id: null,
    like_count: Number(row.like_count ?? 0),
    reply_count: parentId ? 0 : replyCount,
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

function parseIgInsightMetrics(data: IgInsightMetricRow[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const metric of data ?? []) {
    out[String(metric.name ?? "")] = parseIgInsightMetricValue(metric);
  }
  return out;
}

export type InstagramMediaInsights = {
  reach: number;
  /** Play/impression count from Meta (`views`, legacy `impressions`, or media `view_count`). */
  views: number;
  total_interactions: number;
  shares: number;
  /** Media insight `saved`; null if the metric was not returned. */
  save_count: number | null;
  /** Reels-only avg watch time in ms; null if unavailable / non-Reel. */
  avg_watch_time_ms: number | null;
};

async function fetchInstagramMediaViewCountFromFields(
  mediaId: string,
  accessToken: string,
): Promise<number> {
  try {
    // view_count is Business Discovery-only; requesting it fails the call for owned media.
    const data = await graphGet<{
      total_views_count?: number;
    }>(
      graphUrl(mediaId, { fields: "total_views_count" }),
      accessToken,
    );
    return Number(data.total_views_count ?? 0) || 0;
  } catch {
    return 0;
  }
}

async function fetchIgMediaInsightMetrics(
  mediaId: string,
  accessToken: string,
  params: Record<string, string>,
): Promise<Record<string, number>> {
  try {
    const data = await graphGet<{ data?: IgInsightMetricRow[] }>(
      graphUrl(`${mediaId}/insights`, params),
      accessToken,
    );
    return parseIgInsightMetrics(data.data);
  } catch {
    return {};
  }
}

/**
 * Instagram media insights — `views` vs `reach`:
 * - Prefer `total_views` (matches Instagram app when boosted) then organic `views`.
 * - Legacy `impressions` only as fallback (deprecated for media after July 2024).
 * - reach: unique accounts that saw the media at least once.
 *
 * Requests are split because mixing legacy (`impressions`, `engagement` + period)
 * with modern (`metric_type=total_value`) metrics in one call fails the whole batch.
 */
export async function fetchInstagramMediaInsights(
  mediaId: string,
  accessToken: string,
  mediaType?: string | null,
  mediaProductType?: string | null,
): Promise<InstagramMediaInsights> {
  const map = await fetchInstagramMediaInsightsMap(
    [{
      id: mediaId,
      media_type: mediaType ?? null,
      media_product_type: mediaProductType ?? null,
    } as MetaContentPost],
    accessToken,
  );
  return map.get(mediaId) ?? {
    reach: 0,
    views: 0,
    total_interactions: 0,
    shares: 0,
    save_count: null,
    avg_watch_time_ms: null,
  };
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
    total_interactions?: number;
  }>,
): {
  reach: number;
  views: number;
  engagement: number;
  totalLikes: number;
  totalComments: number;
  totalInteractions: number;
} {
  const totalLikes = postRows.reduce((s, p) => s + p.like_count, 0);
  const totalComments = postRows.reduce((s, p) => s + p.comment_count, 0);
  const views = postRows.reduce((s, p) => s + p.view_count, 0);
  const reach = postRows.reduce((s, p) => s + p.reach, 0);
  const totalInteractions = postRows.reduce(
    (s, p) => s + (p.total_interactions ?? 0),
    0,
  );
  const engagement = totalInteractions > 0
    ? totalInteractions
    : totalLikes + totalComments;

  return { reach, views, engagement, totalLikes, totalComments, totalInteractions };
}

/** @deprecated Use buildMetaContentSummaryFromPosts */
export const buildFacebookSummaryFromPosts = buildMetaContentSummaryFromPosts;

export function computeMetaEngagementRate(
  likes: number,
  comments: number,
  views: number,
  shares = 0,
): number | null {
  if (!Number.isFinite(views) || views <= 0) return null;
  const rate = ((likes + comments + shares) / views) * 100;
  if (!Number.isFinite(rate)) return null;
  return rate;
}

/** Engagement % from Meta insights: total_interactions ÷ views (both API-sourced). */
export function computeInstagramEngagementRateFromApi(
  totalInteractions: number,
  views: number,
): number | null {
  if (!Number.isFinite(views) || views <= 0) return null;
  if (!Number.isFinite(totalInteractions) || totalInteractions < 0) return null;
  const rate = (totalInteractions / views) * 100;
  return Number.isFinite(rate) ? rate : null;
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
