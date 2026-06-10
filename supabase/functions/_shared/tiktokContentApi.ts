import { TIKTOK_CONTENT_API_BASE } from "./tiktokContentAuth.ts";

export const VIDEO_LIST_FIELDS = [
  "id",
  "title",
  "create_time",
  "share_url",
  "cover_image_url",
  "view_count",
  "like_count",
  "comment_count",
  "share_count",
  "video_description",
  "duration",
].join(",");

export const USER_INFO_FIELDS = [
  "open_id",
  "display_name",
  "avatar_url",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
].join(",");

type TikTokContentError = {
  code?: string;
  message?: string;
  log_id?: string;
};

type TikTokContentEnvelope<T> = {
  data?: T;
  error?: TikTokContentError;
};

export type TikTokVideoRow = {
  id?: string;
  title?: string;
  create_time?: number;
  share_url?: string;
  cover_image_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  video_description?: string;
  duration?: number;
};

export type TikTokUserInfo = {
  open_id?: string;
  display_name?: string;
  avatar_url?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
};

function throwApiError(prefix: string, err?: TikTokContentError, httpStatus?: number): never {
  const code = err?.code?.trim() ?? "";
  const msg = err?.message?.trim() ?? "";
  const detail = msg && msg !== "ok" && msg !== "OK"
    ? msg
    : code && code !== "ok"
      ? `${prefix} (${code})`
      : httpStatus
        ? `${prefix} HTTP ${httpStatus}`
        : prefix;
  throw new Error(detail);
}

type TikTokOAuthTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  expires_in?: number;
  refresh_expires_in?: number;
};

type TikTokOAuthTokenErrorBody = {
  error?: string | TikTokContentError;
  error_description?: string;
  log_id?: string;
  data?: TikTokOAuthTokenPayload;
} & TikTokOAuthTokenPayload;

function parseTikTokOAuthTokenResponse(json: TikTokOAuthTokenErrorBody): TikTokOAuthTokenPayload {
  const payload = (json.data ?? json) as TikTokOAuthTokenPayload;
  return payload;
}

function throwTikTokOAuthTokenError(
  prefix: string,
  json: TikTokOAuthTokenErrorBody,
  httpStatus: number,
): never {
  if (typeof json.error === "string" && json.error.trim()) {
    const desc = json.error_description?.trim();
    throw new Error(desc || json.error.trim());
  }
  if (json.error && typeof json.error === "object") {
    throwApiError(prefix, json.error, httpStatus);
  }
  throwApiError(prefix, undefined, httpStatus);
}

export async function exchangeTikTokContentAuthCode(
  clientKey: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_in?: number;
  refresh_expires_in?: number;
}> {
  const decodedCode = decodeURIComponent(code);
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code: decodedCode,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${TIKTOK_CONTENT_API_BASE}/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({})) as TikTokOAuthTokenErrorBody;
  const payload = parseTikTokOAuthTokenResponse(json);
  const accessToken = payload.access_token?.trim() ?? "";
  const refreshToken = payload.refresh_token?.trim() ?? "";
  const openId = payload.open_id?.trim() ?? "";

  const envelopeErr =
    json.error && typeof json.error === "object" ? json.error : undefined;
  const envelopeFailed = envelopeErr != null && envelopeErr.code !== "ok";

  if (!res.ok || envelopeFailed || !accessToken || !openId) {
    throwTikTokOAuthTokenError("token_exchange_failed", json, res.status);
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken || accessToken,
    open_id: openId,
    expires_in: payload.expires_in,
    refresh_expires_in: payload.refresh_expires_in,
  };
}

export async function refreshTikTokContentAccessToken(
  clientKey: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  open_id?: string;
  expires_in?: number;
} | null> {
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(`${TIKTOK_CONTENT_API_BASE}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({})) as TikTokOAuthTokenErrorBody;
  const payload = parseTikTokOAuthTokenResponse(json);
  const accessToken = payload.access_token?.trim() ?? "";
  const envelopeErr =
    json.error && typeof json.error === "object" ? json.error : undefined;
  const envelopeFailed = envelopeErr != null && envelopeErr.code !== "ok";
  if (!res.ok || envelopeFailed || !accessToken) {
    const errMsg =
      typeof json.error === "string"
        ? json.error_description ?? json.error
        : envelopeErr?.message ?? String(res.status);
    console.error("tiktok content refresh:", errMsg);
    return null;
  }
  return payload;
}

export async function fetchTikTokUserInfo(accessToken: string): Promise<TikTokUserInfo> {
  const url = `${TIKTOK_CONTENT_API_BASE}/user/info/?fields=${USER_INFO_FIELDS}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as TikTokContentEnvelope<{ user?: TikTokUserInfo }>;
  if (!res.ok || json.error?.code !== "ok") {
    throwApiError("user_info_failed", json.error, res.status);
  }
  return json.data?.user ?? {};
}

export async function fetchTikTokVideoList(
  accessToken: string,
  cursor?: number,
  maxCount = 20,
): Promise<{ videos: TikTokVideoRow[]; cursor?: number; has_more: boolean }> {
  const url = `${TIKTOK_CONTENT_API_BASE}/video/list/?fields=${VIDEO_LIST_FIELDS}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      max_count: maxCount,
      ...(cursor != null && Number.isFinite(cursor) ? { cursor } : {}),
    }),
  });
  const json = await res.json().catch(() => ({})) as TikTokContentEnvelope<{
    videos?: TikTokVideoRow[];
    cursor?: number;
    has_more?: boolean;
  }>;
  if (!res.ok || json.error?.code !== "ok") {
    throwApiError("video_list_failed", json.error, res.status);
  }
  return {
    videos: json.data?.videos ?? [],
    cursor: json.data?.cursor,
    has_more: Boolean(json.data?.has_more),
  };
}

export async function fetchAllTikTokVideosInRange(
  accessToken: string,
  dateStartYmd: string,
  dateEndYmd: string,
  maxPages = 50,
): Promise<TikTokVideoRow[]> {
  const startMs = new Date(`${dateStartYmd}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${dateEndYmd}T23:59:59.999Z`).getTime();
  const all: TikTokVideoRow[] = [];
  let cursor: number | undefined;
  let page = 0;

  while (page < maxPages) {
    const batch = await fetchTikTokVideoList(accessToken, cursor, 20);
    const videos = batch.videos;
    if (videos.length === 0) break;

    let oldestInBatch = Infinity;
    for (const v of videos) {
      const ct = Number(v.create_time ?? 0) * 1000;
      if (Number.isFinite(ct)) oldestInBatch = Math.min(oldestInBatch, ct);
      if (!Number.isFinite(ct)) continue;
      if (ct >= startMs && ct <= endMs) all.push(v);
      if (ct < startMs) {
        return all;
      }
    }

    if (!batch.has_more || batch.cursor == null) break;
    if (Number.isFinite(oldestInBatch) && oldestInBatch < startMs) break;
    cursor = batch.cursor;
    page += 1;
  }

  return all;
}
