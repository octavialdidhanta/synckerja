const THREADS_GRAPH_BASE = "https://graph.threads.net/v1.0";

type GraphError = { error?: { message?: string; code?: number } };

export type ThreadsProfile = {
  id: string;
  username: string | null;
  threads_profile_picture_url: string | null;
};

export type ThreadsPost = {
  id: string;
  caption: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
  comment_count: number;
  like_count: number;
};

export type ThreadsComment = {
  id: string;
  media_id: string;
  text: string;
  author_name: string;
  author_id: string | null;
  reply_count: number;
  parent_comment_id: string | null;
  published_at: string | null;
  is_owner: boolean;
  can_reply: boolean;
};

export function threadsUrl(path: string, params?: Record<string, string>): string {
  const trimmed = path.replace(/^\/+/, "");
  const base = `${THREADS_GRAPH_BASE}/${trimmed}`;
  if (!params || Object.keys(params).length === 0) return base;
  const qs = new URLSearchParams(params);
  return `${base}?${qs.toString()}`;
}

async function threadsGet<T>(url: string, accessToken: string): Promise<T> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json().catch(() => ({})) as T & GraphError;
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message ?? `Threads API error ${res.status}`);
  }
  return data;
}

async function threadsPost<T>(
  url: string,
  accessToken: string,
  body: Record<string, string>,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: accessToken }).toString(),
  });
  const data = await res.json().catch(() => ({})) as T & GraphError;
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message ?? `Threads API error ${res.status}`);
  }
  return data;
}

async function threadsDelete<T>(url: string, accessToken: string): Promise<T> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(accessToken)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({})) as T & GraphError;
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message ?? `Threads API error ${res.status}`);
  }
  return data;
}

import { threadsAppSecret } from "./threadsAppCredentials.ts";

export async function exchangeThreadsAuthCode(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string,
): Promise<{ access_token: string }> {
  const res = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }).toString(),
  });
  const data = await res.json().catch(() => ({})) as {
    access_token?: string;
    error?: { message?: string };
  };
  const token = data?.access_token?.trim() ?? "";
  if (!res.ok || !token) {
    throw new Error(data?.error?.message ?? "Threads authorization code exchange failed");
  }
  return { access_token: token };
}

export async function exchangeThreadsLongLivedToken(
  shortLivedToken: string,
  appSecret?: string,
): Promise<{ access_token: string; expires_in?: number }> {
  const secret = appSecret?.trim() || threadsAppSecret();
  if (!secret) throw new Error("Threads app secret not configured");
  const url = `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(shortLivedToken)}`;
  const res = await fetch(url, { method: "GET" });
  const data = await res.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  const token = data?.access_token?.trim() ?? "";
  if (!res.ok || !token) {
    throw new Error(data?.error?.message ?? "Threads token exchange failed");
  }
  return { access_token: token, expires_in: data.expires_in };
}

export async function refreshThreadsAccessToken(
  longLivedToken: string,
): Promise<{ access_token: string; expires_in?: number } | null> {
  const url = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(longLivedToken)}`;
  const res = await fetch(url, { method: "GET" });
  const data = await res.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  const token = data?.access_token?.trim() ?? "";
  if (!res.ok || !token) {
    console.error("refreshThreadsAccessToken:", data?.error?.message ?? res.status);
    return null;
  }
  return { access_token: token, expires_in: data.expires_in };
}

export async function fetchThreadsProfile(accessToken: string): Promise<ThreadsProfile> {
  const data = await threadsGet<Record<string, unknown>>(
    threadsUrl("me", { fields: "id,username,threads_profile_picture_url" }),
    accessToken,
  );
  return {
    id: String(data.id ?? ""),
    username: typeof data.username === "string" ? data.username : null,
    threads_profile_picture_url: typeof data.threads_profile_picture_url === "string"
      ? data.threads_profile_picture_url
      : null,
  };
}

/** Scopes actually granted on the Threads user token (via graph.threads.net debug_token). */
export async function fetchThreadsGrantedPermissions(
  accessToken: string,
  appId?: string,
  appSecret?: string,
): Promise<string[]> {
  const inspectors: string[] = [accessToken];
  const trimmedAppId = appId?.trim() ?? "";
  const trimmedSecret = appSecret?.trim() ?? "";
  if (trimmedAppId && trimmedSecret) {
    inspectors.push(`${trimmedAppId}|${trimmedSecret}`);
  }

  for (const inspectorToken of inspectors) {
    try {
      const data = await threadsGet<{
        data?: {
          scopes?: string[];
          granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>;
          is_valid?: boolean;
        };
      }>(
        threadsUrl("debug_token", { input_token: accessToken }),
        inspectorToken,
      );
      const flat = Array.isArray(data.data?.scopes) ? data.data!.scopes!.map(String) : [];
      const granular = (data.data?.granular_scopes ?? [])
        .map((row) => String(row.scope ?? "").trim())
        .filter(Boolean);
      const merged = [...new Set([...flat, ...granular])];
      if (merged.length > 0) return merged;
    } catch (e) {
      const label = inspectorToken === accessToken ? "user token" : "app token";
      console.warn(`fetchThreadsGrantedPermissions (${label}):`, e);
    }
  }
  return [];
}

/** Live probe: reply quota config is only returned when publish+reply permissions are on the token. */
export async function canThreadsTokenPublishReplies(
  threadsUserId: string,
  accessToken: string,
): Promise<boolean> {
  const userId = threadsUserId?.trim() || "me";
  try {
    const data = await threadsGet<{
      data?: Array<{ reply_config?: { quota_total?: number }; reply_quota_usage?: number }>;
    }>(
      threadsUrl(`${userId}/threads_publishing_limit`, {
        fields: "reply_quota_usage,reply_config",
      }),
      accessToken,
    );
    const row = data.data?.[0];
    return Number(row?.reply_config?.quota_total ?? 0) > 0;
  } catch (e) {
    console.warn("canThreadsTokenPublishReplies:", e);
    return false;
  }
}

function isThreadsReplyPermissionError(message: string): boolean {
  return /does not have permission|unsupported post request|not support this operation/i.test(message);
}

function isThreadsReplyRetryableError(message: string): boolean {
  return isThreadsReplyPermissionError(message) ||
    /does not exist|nonexisting|unsupported get request|\(#100\)|invalid parameter/i.test(message);
}

export type ThreadsMediaContext = {
  id: string;
  repliedToId: string | null;
  rootPostId: string | null;
  isReply: boolean;
};

export async function fetchThreadsMediaContext(
  mediaOrReplyId: string,
  accessToken: string,
): Promise<ThreadsMediaContext | null> {
  const seed = String(mediaOrReplyId ?? "").trim();
  if (!seed) return null;
  try {
    const data = await threadsGet<{
      id?: string;
      is_reply?: boolean;
      replied_to?: { id?: string };
      root_post?: { id?: string };
    }>(
      threadsUrl(seed, { fields: "id,is_reply,replied_to,root_post" }),
      accessToken,
    );
    const id = String(data.id ?? "").trim();
    if (!id) return null;
    return {
      id,
      repliedToId: data.replied_to?.id != null ? String(data.replied_to.id).trim() : null,
      rootPostId: data.root_post?.id != null ? String(data.root_post.id).trim() : null,
      isReply: Boolean(data.is_reply),
    };
  } catch {
    return null;
  }
}

/** Ordered reply_to_id candidates — verify via Graph before publishing. */
export async function buildThreadsReplyTargetIds(
  postMediaId: string,
  replyToCommentId: string | undefined,
  accessToken: string,
): Promise<string[]> {
  const postId = String(postMediaId ?? "").trim();
  const commentId = String(replyToCommentId ?? "").trim();
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const value = String(id ?? "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    ordered.push(value);
  };

  if (commentId && commentId !== postId) {
    const commentCtx = await fetchThreadsMediaContext(commentId, accessToken);
    if (commentCtx?.id) push(commentCtx.id);
    if (commentCtx?.rootPostId) push(commentCtx.rootPostId);
    if (commentCtx?.repliedToId && commentCtx.repliedToId !== commentCtx.id) {
      push(commentCtx.repliedToId);
    }
  }

  const resolvedPost = await resolveThreadsPostIdFromReplyChain(postId, accessToken);
  push(resolvedPost ?? postId);

  if (commentId) push(commentId);

  return ordered.length > 0 ? ordered : (postId ? [postId] : []);
}

function timestampToUtcYmd(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toUnixSinceUntil(dateStart: string, dateEnd: string): { since: string; until: string } {
  const nowSec = Math.floor(Date.now() / 1000);
  const parseYmd = (raw: string, endOfDay: boolean): number => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (!m) return endOfDay ? nowSec : nowSec - 29 * 86400;
    const [, y, mo, d] = m;
    const date = new Date(
      Date.UTC(Number(y), Number(mo) - 1, Number(d), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0),
    );
    return Math.floor(date.getTime() / 1000);
  };
  let since = parseYmd(dateStart, false);
  let until = parseYmd(dateEnd, true);
  if (since > until) since = until;
  if (until > nowSec) until = nowSec;
  return { since: String(since), until: String(until) };
}

function mapThreadsPost(row: Record<string, unknown>): ThreadsPost {
  return {
    id: String(row.id ?? ""),
    caption: typeof row.text === "string" ? row.text : null,
    media_type: typeof row.media_type === "string" ? row.media_type : null,
    media_url: typeof row.media_url === "string" ? row.media_url : null,
    thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    permalink: typeof row.permalink === "string" ? row.permalink : null,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
    comment_count: 0,
    like_count: 0,
  };
}

export type FetchThreadsListOptions = {
  startYmd?: string;
  endYmd?: string;
  /** Paginate through posts without API since/until (up to `limit`). */
  allTime?: boolean;
};

export async function fetchThreadsList(
  accessToken: string,
  limit = 25,
  options?: FetchThreadsListOptions,
): Promise<ThreadsPost[]> {
  const fields = "id,media_type,media_url,permalink,text,timestamp,thumbnail_url";
  const cap = Math.min(Math.max(limit, 1), 100);
  const filterByDate = Boolean(
    options?.startYmd && options?.endYmd && !options?.allTime,
  );
  const paginate = filterByDate || options?.allTime === true;

  const params: Record<string, string> = {
    fields,
    limit: "25",
  };
  if (filterByDate && options?.startYmd && options?.endYmd) {
    const { since, until } = toUnixSinceUntil(options.startYmd, options.endYmd);
    params.since = since;
    params.until = until;
  }

  const inRange: ThreadsPost[] = [];
  let after: string | undefined;
  const maxPages = paginate ? 40 : 1;

  for (let page = 0; page < maxPages && inRange.length < cap; page++) {
    const pageParams = { ...params };
    if (after) pageParams.after = after;

    const data = await threadsGet<{
      data?: Array<Record<string, unknown>>;
      paging?: { cursors?: { after?: string } };
    }>(threadsUrl("me/threads", pageParams), accessToken);

    const batch = (data.data ?? []).map(mapThreadsPost);
    if (batch.length === 0) break;

    for (const post of batch) {
      if (filterByDate && options?.startYmd && options?.endYmd) {
        if (!post.timestamp) continue;
        const ymd = timestampToUtcYmd(post.timestamp);
        if (!ymd || ymd < options.startYmd || ymd > options.endYmd) continue;
      }
      inRange.push(post);
      if (inRange.length >= cap) break;
    }

    if (filterByDate && options?.startYmd) {
      const oldest = batch[batch.length - 1];
      const oldestYmd = oldest?.timestamp ? timestampToUtcYmd(oldest.timestamp) : "";
      if (oldestYmd && oldestYmd < options.startYmd) break;
    }

    after = data.paging?.cursors?.after;
    if (!after) break;
  }

  return inRange;
}

/** Top-level reply count for manage-comments sidebar (matches listComments filter). */
export async function countThreadTopLevelReplies(
  mediaId: string,
  accessToken: string,
): Promise<number> {
  const conversation = await fetchThreadConversation(mediaId, accessToken);
  return buildTopLevelCommentsFromConversation(conversation, mediaId).length;
}

export async function enrichThreadsPostsWithCommentCounts(
  posts: ThreadsPost[],
  accessToken: string,
): Promise<ThreadsPost[]> {
  const batchSize = 8;
  const enriched: ThreadsPost[] = [];
  for (let i = 0; i < posts.length; i += batchSize) {
    const chunk = posts.slice(i, i + batchSize);
    const rows = await Promise.all(
      chunk.map(async (post) => {
        try {
          const commentCount = await countThreadTopLevelReplies(post.id, accessToken);
          return { ...post, comment_count: commentCount };
        } catch {
          return post;
        }
      }),
    );
    enriched.push(...rows);
  }
  return enriched;
}

type InsightMetricRow = {
  name?: string;
  values?: Array<{ value?: number }>;
  total_value?: { value?: number };
};

function parseInsightValue(row: InsightMetricRow): number {
  if (row.total_value != null && Number.isFinite(Number(row.total_value.value))) {
    return Number(row.total_value.value);
  }
  return (row.values ?? []).reduce((acc, v) => acc + Number(v.value ?? 0), 0);
}

export async function fetchThreadInsights(
  mediaId: string,
  accessToken: string,
): Promise<{ views: number; likes: number; replies: number; reposts: number; quotes: number }> {
  try {
    const data = await threadsGet<{ data?: InsightMetricRow[] }>(
      threadsUrl(`${mediaId}/insights`, {
        metric: "views,likes,replies,reposts,quotes",
      }),
      accessToken,
    );
    const out: Record<string, number> = {};
    for (const row of data.data ?? []) {
      out[String(row.name ?? "")] = parseInsightValue(row);
    }
    return {
      views: out.views ?? 0,
      likes: out.likes ?? 0,
      replies: out.replies ?? 0,
      reposts: out.reposts ?? 0,
      quotes: out.quotes ?? 0,
    };
  } catch {
    return { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 };
  }
}

export async function fetchThreadsUserInsights(
  accessToken: string,
  since: string,
  until: string,
): Promise<{ views: number; likes: number; replies: number; reposts: number }> {
  try {
    const data = await threadsGet<{ data?: InsightMetricRow[] }>(
      threadsUrl("me/threads_insights", {
        metric: "views,likes,replies,reposts",
        since,
        until,
        period: "day",
      }),
      accessToken,
    );
    const out: Record<string, number> = {};
    for (const row of data.data ?? []) {
      out[String(row.name ?? "")] = parseInsightValue(row);
    }
    return {
      views: out.views ?? 0,
      likes: out.likes ?? 0,
      replies: out.replies ?? 0,
      reposts: out.reposts ?? 0,
    };
  } catch {
    return { views: 0, likes: 0, replies: 0, reposts: 0 };
  }
}

export async function fetchThreadsFollowerCount(accessToken: string): Promise<number | null> {
  try {
    const data = await threadsGet<{ data?: InsightMetricRow[] }>(
      threadsUrl("me/threads_insights", {
        metric: "follower_count",
        period: "lifetime",
      }),
      accessToken,
    );
    const row = (data.data ?? []).find((r) => String(r.name ?? "") === "follower_count");
    if (!row) return null;
    const count = parseInsightValue(row);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

function mapThreadsReply(
  row: Record<string, unknown>,
  fetchTargetId: string,
  parentId: string | null,
): ThreadsComment {
  const repliedTo = row.replied_to as { id?: string } | undefined;
  const rootPost = row.root_post as { id?: string } | undefined;
  const rootId = rootPost?.id ? String(rootPost.id) : fetchTargetId;
  const parent = parentId ?? (repliedTo?.id ? String(repliedTo.id) : null);
  return {
    id: String(row.id ?? ""),
    media_id: rootId,
    text: typeof row.text === "string" ? row.text : "",
    author_name: typeof row.username === "string" ? row.username : "Unknown",
    author_id: null,
    reply_count: Number(row.reply_count ?? 0),
    parent_comment_id: parent,
    published_at: typeof row.timestamp === "string" ? row.timestamp : null,
    is_owner: Boolean(row.is_reply_owned_by_me),
    can_reply: true,
  };
}

const THREADS_REPLY_FIELDS =
  "id,text,username,timestamp,reply_count,replied_to,root_post,is_reply,is_reply_owned_by_me,hide_status,has_replies";

function dedupeThreadsCommentsById(comments: ThreadsComment[]): ThreadsComment[] {
  const seen = new Set<string>();
  const out: ThreadsComment[] = [];
  for (const row of comments) {
    const id = String(row.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

export function buildTopLevelCommentsFromConversation(
  conversation: ThreadsComment[],
  postMediaId: string,
): ThreadsComment[] {
  const postId = String(postMediaId ?? "").trim();
  return conversation.filter(
    (c) => c.id !== postId && (!c.parent_comment_id || c.parent_comment_id === postId),
  );
}

export function enrichTopLevelReplyCountsFromConversation(
  topLevel: ThreadsComment[],
  conversation: ThreadsComment[],
): ThreadsComment[] {
  return topLevel.map((comment) => enrichCommentReplyCountFromConversation(comment, conversation));
}

export function enrichCommentReplyCountFromConversation(
  comment: ThreadsComment,
  conversation: ThreadsComment[],
): ThreadsComment {
  const nestedCount = conversation.filter((c) => c.parent_comment_id === comment.id).length;
  return { ...comment, reply_count: Math.max(comment.reply_count, nestedCount) };
}

export function enrichReplyCountsFromConversation(
  replies: ThreadsComment[],
  conversation: ThreadsComment[],
): ThreadsComment[] {
  return replies.map((reply) => enrichCommentReplyCountFromConversation(reply, conversation));
}

export function countConversationActivity(
  conversation: ThreadsComment[],
  postMediaId: string,
): number {
  const postId = String(postMediaId ?? "").trim();
  return conversation.filter((c) => c.id !== postId).length;
}

export function filterNestedRepliesFromConversation(
  conversation: ThreadsComment[],
  parentCommentId: string,
): ThreadsComment[] {
  const parentId = String(parentCommentId ?? "").trim();
  return conversation.filter((c) => c.parent_comment_id === parentId);
}

async function fetchThreadPendingReplies(
  postMediaId: string,
  accessToken: string,
): Promise<ThreadsComment[]> {
  const postId = String(postMediaId ?? "").trim();
  if (!postId) return [];
  try {
    const data = await threadsGet<{ data?: Array<Record<string, unknown>> }>(
      threadsUrl(`${postId}/pending_replies`, { fields: THREADS_REPLY_FIELDS, limit: "25" }),
      accessToken,
    );
    return (data.data ?? []).map((row) => mapThreadsReply(row, postId, null));
  } catch {
    return [];
  }
}

/** Flattened top-level + nested replies — includes replies created in the Threads app. */
export async function fetchThreadConversation(
  postMediaId: string,
  accessToken: string,
  maxPages = 12,
): Promise<ThreadsComment[]> {
  const postId = String(postMediaId ?? "").trim();
  if (!postId) return [];

  const all: ThreadsComment[] = [];
  let after: string | undefined;
  let conversationSupported = true;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      fields: THREADS_REPLY_FIELDS,
      limit: "25",
    };
    if (after) params.after = after;

    try {
      const data = await threadsGet<{
        data?: Array<Record<string, unknown>>;
        paging?: { cursors?: { after?: string } };
      }>(threadsUrl(`${postId}/conversation`, params), accessToken);
      const batch = (data.data ?? []).map((row) => mapThreadsReply(row, postId, null));
      all.push(...batch);
      after = data.paging?.cursors?.after;
      if (!after || batch.length === 0) break;
    } catch (e) {
      conversationSupported = false;
      console.warn("fetchThreadConversation fallback:", postId, e);
      break;
    }
  }

  if (!conversationSupported && all.length === 0) {
    const topLevel = await fetchThreadRepliesPaginated(postId, accessToken, maxPages);
    const pending = await fetchThreadPendingReplies(postId, accessToken);
    return dedupeThreadsCommentsById([...topLevel, ...pending]);
  }

  const pending = await fetchThreadPendingReplies(postId, accessToken);
  return dedupeThreadsCommentsById([...all, ...pending]);
}

export async function fetchThreadRepliesPaginated(
  mediaId: string,
  accessToken: string,
  maxPages = 8,
): Promise<ThreadsComment[]> {
  const targetId = String(mediaId ?? "").trim();
  if (!targetId) return [];

  const all: ThreadsComment[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      fields: THREADS_REPLY_FIELDS,
      limit: "25",
    };
    if (after) params.after = after;

    try {
      const data = await threadsGet<{
        data?: Array<Record<string, unknown>>;
        paging?: { cursors?: { after?: string } };
      }>(threadsUrl(`${targetId}/replies`, params), accessToken);
      const batch = (data.data ?? []).map((row) => mapThreadsReply(row, targetId, null));
      all.push(...batch);
      after = data.paging?.cursors?.after;
      if (!after || batch.length === 0) break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        /does not exist|unsupported get request|nonexisting|\(#100\)/i.test(msg) ||
        /missing permissions|\(#10\)|\(#200\)/i.test(msg)
      ) {
        console.warn("fetchThreadRepliesPaginated soft-empty:", targetId, msg);
        break;
      }
      throw e;
    }
  }

  return dedupeThreadsCommentsById(all);
}

export async function fetchThreadReplies(
  mediaId: string,
  accessToken: string,
): Promise<ThreadsComment[]> {
  return fetchThreadRepliesPaginated(mediaId, accessToken, 4);
}

/** Prefer full conversation tree; fall back to per-comment /replies. */
export async function fetchThreadNestedReplies(
  postMediaId: string,
  parentCommentId: string,
  accessToken: string,
): Promise<ThreadsComment[]> {
  const parentId = String(parentCommentId ?? "").trim();
  const postId = String(postMediaId ?? "").trim();
  if (!parentId) return [];

  const conversation = postId ? await fetchThreadConversation(postId, accessToken) : [];
  const fromConversation = filterNestedRepliesFromConversation(conversation, parentId);
  if (fromConversation.length > 0) return fromConversation;

  const direct = await fetchThreadRepliesPaginated(parentId, accessToken);
  if (direct.length > 0) {
    return direct.map((row) => ({
      ...row,
      parent_comment_id: row.parent_comment_id === parentId ? row.parent_comment_id : parentId,
    }));
  }

  if (!postId || parentId === postId) return [];

  const topLevel = await fetchThreadRepliesPaginated(postId, accessToken);
  return topLevel.filter((row) => row.parent_comment_id === parentId);
}

export async function enrichThreadsTopLevelCommentsWithReplyCounts(
  comments: ThreadsComment[],
  accessToken: string,
  postMediaId?: string,
): Promise<ThreadsComment[]> {
  const postId = String(postMediaId ?? comments[0]?.media_id ?? "").trim();
  if (postId) {
    const conversation = await fetchThreadConversation(postId, accessToken);
    const topLevel = buildTopLevelCommentsFromConversation(conversation, postId);
    const enriched = enrichTopLevelReplyCountsFromConversation(topLevel, conversation);
    const enrichedById = new Map(enriched.map((c) => [c.id, c]));
    return comments.map((c) => enrichedById.get(c.id) ?? c);
  }

  const batchSize = 8;
  const enriched: ThreadsComment[] = [];
  for (let i = 0; i < comments.length; i += batchSize) {
    const chunk = comments.slice(i, i + batchSize);
    const rows = await Promise.all(
      chunk.map(async (comment) => {
        try {
          const nested = await fetchThreadRepliesPaginated(comment.id, accessToken, 4);
          return { ...comment, reply_count: Math.max(comment.reply_count, nested.length) };
        } catch {
          return comment;
        }
      }),
    );
    enriched.push(...rows);
  }
  return enriched;
}

export async function fetchThreadsRepliedToId(
  mediaOrReplyId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const data = await threadsGet<{ replied_to?: { id?: string } }>(
      threadsUrl(`${mediaOrReplyId}`, { fields: "replied_to" }),
      accessToken,
    );
    const parent = data.replied_to?.id != null ? String(data.replied_to.id).trim() : "";
    return parent || null;
  } catch {
    return null;
  }
}

/** Walk replied_to chain to find the root post/media id for /{id}/replies. */
export async function resolveThreadsPostIdFromReplyChain(
  startId: string,
  accessToken: string,
  maxHops = 5,
): Promise<string | null> {
  let current = String(startId ?? "").trim();
  if (!current) return null;
  for (let hop = 0; hop < maxHops; hop++) {
    const parent = await fetchThreadsRepliedToId(current, accessToken);
    if (!parent || parent === current) return current;
    current = parent;
  }
  return current;
}

export function extractRootPostIdFromRawMetadata(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const meta = raw as Record<string, unknown>;
  const values = meta.values as { value?: Record<string, unknown> } | undefined;
  const rootPost = values?.value?.root_post as { id?: unknown } | undefined;
  if (rootPost?.id != null && String(rootPost.id).trim()) {
    return String(rootPost.id).trim();
  }
  return null;
}

export async function resolveThreadsPostMediaIdForReply(
  admin: import("https://esm.sh/@supabase/supabase-js@2").SupabaseClient,
  conversationId: string,
  storedRootMediaId: string,
  accessToken: string,
  replyToCommentId?: string | null,
): Promise<string> {
  let root = String(storedRootMediaId ?? "").trim();
  const replyTo = replyToCommentId?.trim() ?? "";

  const { data: msgRows } = await admin
    .from("threads_messages")
    .select("raw_metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(10);

  for (const row of msgRows ?? []) {
    const fromMeta = extractRootPostIdFromRawMetadata(
      (row as { raw_metadata?: unknown }).raw_metadata,
    );
    if (fromMeta) {
      root = fromMeta;
      break;
    }
  }

  if (!root || (replyTo && root === replyTo)) {
    const seed = replyTo || root || storedRootMediaId;
    const resolved = await resolveThreadsPostIdFromReplyChain(seed, accessToken);
    if (resolved) root = resolved;
  }

  if (root && root !== storedRootMediaId) {
    await admin
      .from("threads_conversations")
      .update({ root_media_id: root, updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  return root || storedRootMediaId;
}

async function threadsPostStep<T>(
  step: "create_reply_container" | "publish_reply",
  url: string,
  accessToken: string,
  body: Record<string, string>,
): Promise<T> {
  try {
    return await threadsPost<T>(url, accessToken, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not have permission/i.test(msg)) {
      const hint = step === "publish_reply"
        ? "threads_content_publish"
        : "threads_manage_replies (and threads_content_publish for nested replies)";
      throw new Error(`${msg} (${step}: requires ${hint} on the Threads access token)`);
    }
    throw e;
  }
}

async function publishThreadsReplyContainer(
  creationId: string,
  accessToken: string,
  threadsUserId?: string,
): Promise<{ id: string }> {
  const publishPaths = ["me/threads_publish"];
  const explicitUserId = threadsUserId?.trim();
  if (explicitUserId) publishPaths.push(`${explicitUserId}/threads_publish`);

  let lastError: Error | null = null;
  for (const path of publishPaths) {
    try {
      const published = await threadsPostStep<{ id?: string }>(
        "publish_reply",
        threadsUrl(path),
        accessToken,
        { creation_id: creationId },
      );
      return { id: String(published.id ?? "") };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!isThreadsReplyRetryableError(lastError.message)) throw lastError;
    }
  }
  throw lastError ?? new Error("Failed to publish Threads reply");
}

async function tryDirectThreadsReplyPost(
  targetId: string,
  text: string,
  accessToken: string,
): Promise<{ id: string } | null> {
  try {
    const data = await threadsPost<{ id?: string }>(
      threadsUrl(`${targetId}/replies`),
      accessToken,
      { text, media_type: "TEXT" },
    );
    const id = String(data.id ?? "").trim();
    return id ? { id } : null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isThreadsReplyRetryableError(msg)) return null;
    throw e instanceof Error ? e : new Error(msg);
  }
}

async function tryContainerThreadsReplyPost(
  replyToId: string,
  text: string,
  accessToken: string,
  threadsUserId?: string,
): Promise<{ id: string } | null> {
  const createPaths = ["me/threads"];
  const explicitUserId = threadsUserId?.trim();
  if (explicitUserId) createPaths.push(`${explicitUserId}/threads`);

  let lastError: Error | null = null;
  for (const createPath of createPaths) {
    try {
      const container = await threadsPostStep<{ id?: string }>(
        "create_reply_container",
        threadsUrl(createPath),
        accessToken,
        {
          media_type: "TEXT",
          text,
          reply_to_id: replyToId,
        },
      );
      const creationId = String(container.id ?? "").trim();
      if (!creationId) throw new Error("Failed to create Threads reply container");
      return await publishThreadsReplyContainer(creationId, accessToken, threadsUserId);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!isThreadsReplyRetryableError(lastError.message)) throw lastError;
      console.warn(`tryContainerThreadsReplyPost retry (${createPath}, reply_to_id=${replyToId}):`, lastError.message);
    }
  }
  if (lastError) throw lastError;
  return null;
}

export async function replyThreadsComment(
  mediaId: string,
  text: string,
  accessToken: string,
  replyToCommentId?: string,
  threadsUserId?: string,
): Promise<{ id: string }> {
  const postId = String(mediaId ?? "").trim();
  const commentId = replyToCommentId?.trim() ?? "";
  if (!postId || !text.trim()) throw new Error("Missing reply target");

  const targetIds = await buildThreadsReplyTargetIds(postId, commentId || undefined, accessToken);
  const attempts: string[] = [];
  let lastError: Error | null = null;

  for (const targetId of targetIds) {
    attempts.push(`POST /${targetId}/replies`);
    try {
      const direct = await tryDirectThreadsReplyPost(targetId, text, accessToken);
      if (direct?.id) return direct;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  for (const targetId of targetIds) {
    attempts.push(`reply_to_id=${targetId} (container+publish)`);
    try {
      const published = await tryContainerThreadsReplyPost(targetId, text, accessToken, threadsUserId);
      if (published?.id) return published;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!isThreadsReplyRetryableError(lastError.message)) break;
    }
  }

  const detail = attempts.length > 0 ? ` Attempts: ${attempts.join("; ")}.` : "";
  const base = lastError?.message ?? "Failed to publish Threads reply";
  throw new Error(`${base}${detail}`);
}

const THREADS_EDIT_WINDOW_MS = 15 * 60 * 1000;

export function canEditThreadsComment(
  publishedAt: string | null | undefined,
  isOwner: boolean,
): boolean {
  if (!isOwner || !publishedAt) return false;
  const ms = Date.parse(publishedAt);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= THREADS_EDIT_WINDOW_MS;
}

export async function hideThreadsReply(
  replyId: string,
  accessToken: string,
  hide = true,
): Promise<void> {
  const id = String(replyId ?? "").trim();
  if (!id) throw new Error("Missing reply id");
  await threadsPost(threadsUrl(`${id}/manage_reply`), accessToken, {
    hide: hide ? "true" : "false",
  });
}

export async function deleteThreadsMedia(
  mediaId: string,
  accessToken: string,
): Promise<{ deleted_id?: string }> {
  const id = String(mediaId ?? "").trim();
  if (!id) throw new Error("Missing media id");
  return threadsDelete<{ success?: boolean; deleted_id?: string }>(
    threadsUrl(id),
    accessToken,
  );
}

export async function editThreadsReply(
  args: {
    postMediaId: string;
    replyId: string;
    parentCommentId: string;
    text: string;
    accessToken: string;
    threadsUserId?: string;
    publishedAt?: string | null;
    isOwner?: boolean;
  },
): Promise<{ id: string }> {
  const postId = String(args.postMediaId ?? "").trim();
  const replyId = String(args.replyId ?? "").trim();
  const parentId = String(args.parentCommentId ?? "").trim();
  const text = String(args.text ?? "").trim();
  if (!postId || !replyId || !parentId || !text) {
    throw new Error("Missing edit target");
  }
  if (!canEditThreadsComment(args.publishedAt, Boolean(args.isOwner))) {
    throw new Error("Threads replies can only be edited within 15 minutes of posting.");
  }
  await deleteThreadsMedia(replyId, args.accessToken);
  return replyThreadsComment(postId, text, args.accessToken, parentId, args.threadsUserId);
}

export function computeThreadsEngagementRate(
  likes: number,
  comments: number,
  views: number,
  shares = 0,
): number | null {
  if (!Number.isFinite(views) || views <= 0) return null;
  const rate = ((likes + comments + shares) / views) * 100;
  return Number.isFinite(rate) ? rate : null;
}

export async function buildThreadsMetricsPostRows(
  posts: ThreadsPost[],
  accessToken: string,
  accountId: string,
): Promise<Array<{
  platform: "threads";
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
}>> {
  const rows = [];
  for (const post of posts) {
    const insights = await fetchThreadInsights(post.id, accessToken);
    const likeCount = insights.likes;
    const commentCount = insights.replies;
    const viewCount = insights.views;
    const shareCount = insights.reposts + insights.quotes;
    rows.push({
      platform: "threads" as const,
      account_id: accountId,
      content_id: post.id,
      posted_at: post.timestamp,
      view_count: viewCount,
      like_count: likeCount,
      comment_count: commentCount,
      share_count: shareCount,
      reach: viewCount,
      engagement_rate: computeThreadsEngagementRate(likeCount, commentCount, viewCount, shareCount),
      caption: post.caption,
      media_url: post.media_url ?? post.thumbnail_url,
      permalink: post.permalink,
    });
  }
  return rows;
}

export function buildThreadsSummaryFromPosts(
  postRows: Array<{ view_count: number; like_count: number; comment_count: number; reach: number }>,
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
  if (reach > 0 && views < reach) views = reach;
  return { reach, views, engagement: totalLikes + totalComments, totalLikes, totalComments };
}
