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
  like_count: number;
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

export async function fetchThreadsList(
  accessToken: string,
  limit = 25,
  dateRange?: { startYmd: string; endYmd: string },
): Promise<ThreadsPost[]> {
  const fields = "id,media_type,media_url,permalink,text,timestamp,thumbnail_url";
  const params: Record<string, string> = {
    fields,
    limit: String(Math.min(Math.max(limit, 1), 25)),
  };
  if (dateRange?.startYmd && dateRange?.endYmd) {
    const { since, until } = toUnixSinceUntil(dateRange.startYmd, dateRange.endYmd);
    params.since = since;
    params.until = until;
  }

  const inRange: ThreadsPost[] = [];
  let after: string | undefined;
  const maxPages = dateRange ? 25 : 1;

  for (let page = 0; page < maxPages && inRange.length < limit; page++) {
    const pageParams = { ...params };
    if (after) pageParams.after = after;

    const data = await threadsGet<{
      data?: Array<Record<string, unknown>>;
      paging?: { cursors?: { after?: string } };
    }>(threadsUrl("me/threads", pageParams), accessToken);

    const batch = (data.data ?? []).map(mapThreadsPost);
    if (batch.length === 0) break;

    if (!dateRange) {
      return batch.slice(0, limit);
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

  return inRange;
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
  mediaId: string,
  parentId: string | null,
): ThreadsComment {
  const repliedTo = row.replied_to as { id?: string } | undefined;
  const parent = parentId ?? (repliedTo?.id ? String(repliedTo.id) : null);
  return {
    id: String(row.id ?? ""),
    media_id: mediaId,
    text: typeof row.text === "string" ? row.text : "",
    author_name: typeof row.username === "string" ? row.username : "Unknown",
    author_id: null,
    like_count: Number(row.like_count ?? 0),
    reply_count: Number(row.reply_count ?? 0),
    parent_comment_id: parent,
    published_at: typeof row.timestamp === "string" ? row.timestamp : null,
    is_owner: Boolean(row.is_reply_owned_by_me),
    can_reply: true,
  };
}

export async function fetchThreadReplies(
  mediaId: string,
  accessToken: string,
): Promise<ThreadsComment[]> {
  const fields = "id,text,username,timestamp,like_count,reply_count,replied_to,is_reply,is_reply_owned_by_me";
  const data = await threadsGet<{ data?: Array<Record<string, unknown>> }>(
    threadsUrl(`${mediaId}/replies`, { fields, limit: "25" }),
    accessToken,
  );
  return (data.data ?? []).map((row) => mapThreadsReply(row, mediaId, null));
}

export async function replyThreadsComment(
  mediaId: string,
  text: string,
  accessToken: string,
  replyToCommentId?: string,
): Promise<{ id: string }> {
  const body: Record<string, string> = {
    media_type: "TEXT",
    text,
  };
  if (replyToCommentId?.trim()) {
    body.reply_to = replyToCommentId.trim();
  }
  const data = await threadsPost<{ id?: string }>(
    threadsUrl(`${mediaId}/replies`),
    accessToken,
    body,
  );
  return { id: String(data.id ?? "") };
}

export function computeThreadsEngagementRate(
  likes: number,
  comments: number,
  views: number,
): number | null {
  if (!Number.isFinite(views) || views <= 0) return null;
  const rate = ((likes + comments) / views) * 100;
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
    rows.push({
      platform: "threads" as const,
      account_id: accountId,
      content_id: post.id,
      posted_at: post.timestamp,
      view_count: viewCount,
      like_count: likeCount,
      comment_count: commentCount,
      share_count: insights.reposts + insights.quotes,
      reach: viewCount,
      engagement_rate: computeThreadsEngagementRate(likeCount, commentCount, viewCount),
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
