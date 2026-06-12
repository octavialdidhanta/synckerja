import {
  TIKTOK_BUSINESS_API_BASE,
  TIKTOK_CONTENT_API_BASE,
  TIKTOK_CONTENT_OAUTH_TOKEN_KINDS,
  type TikTokContentOAuthTokenKind,
} from "./tiktokContentAuth.ts";
import { normalizeTikTokCaptionFromApi } from "./formatTikTokCaption.ts";

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
  const logId = err?.log_id?.trim();
  const logSuffix = logId ? ` [log_id=${logId}]` : "";
  const detail = msg && msg !== "ok" && msg !== "OK"
    ? `${prefix}: ${msg}${code && code !== "ok" ? ` (${code})` : ""}${logSuffix}`
    : code && code !== "ok"
      ? `${prefix} (${code})${logSuffix}`
      : httpStatus
        ? `${prefix} HTTP ${httpStatus}${logSuffix}`
        : `${prefix}${logSuffix}`;
  throw new Error(detail);
}

type TikTokOAuthTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  expires_in?: number;
  refresh_expires_in?: number;
};


export type TikTokCommentApiRow = {
  id?: string;
  video_id?: string;
  text?: string;
  like_count?: number;
  reply_count?: number;
  parent_comment_id?: string | null;
  create_time?: number;
  display_name?: string;
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

/** TikTok often omits scope in token JSON; read every known location. */
export function parseOAuthScopeFromTokenJson(json: TikTokOAuthTokenErrorBody): string | undefined {
  const payload = parseTikTokOAuthTokenResponse(json);
  const candidates = [
    payload.scope,
    typeof json.scope === "string" ? json.scope : undefined,
    json.data && typeof json.data === "object" && "scope" in json.data
      ? String((json.data as { scope?: unknown }).scope ?? "")
      : undefined,
  ];
  for (const raw of candidates) {
    const trimmed = String(raw ?? "").trim();
    if (trimmed) return trimmed;
  }
  return undefined;
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
  scope?: string;
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

  const scopeParsed = parseOAuthScopeFromTokenJson(json);

  return {
    access_token: accessToken,
    refresh_token: refreshToken || accessToken,
    open_id: openId,
    scope: scopeParsed,
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
  scope?: string;
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
  return {
    access_token: accessToken,
    refresh_token: payload.refresh_token?.trim() || undefined,
    open_id: payload.open_id?.trim() || undefined,
    scope: parseOAuthScopeFromTokenJson(json),
    expires_in: payload.expires_in,
  };
}

type TikTokBusinessOAuthTokenData = {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  creator_id?: string;
  scope?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  access_token_expires_in?: number;
};

function parseTikTokBusinessOAuthTokenResponse(
  json: { data?: TikTokBusinessOAuthTokenData },
): TikTokBusinessOAuthTokenData {
  return json.data ?? {};
}

type TikTokBusinessTokenExchangeResponse = {
  code?: number;
  message?: string;
  data?: TikTokBusinessOAuthTokenData;
};

function parseBusinessTokenExchangeResult(
  json: TikTokBusinessTokenExchangeResponse,
): {
  access_token: string;
  refresh_token: string;
  open_id: string;
  scope?: string;
  expires_in?: number;
  refresh_expires_in?: number;
} | null {
  const payload = json.data ?? {};
  const accessToken = payload.access_token?.trim() ?? "";
  const refreshToken = payload.refresh_token?.trim() ?? "";
  const openId = payload.open_id?.trim() ?? payload.creator_id?.trim() ?? "";
  if (json.code !== 0 || !accessToken || !openId) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken || accessToken,
    open_id: openId,
    scope: payload.scope?.trim() || undefined,
    expires_in: payload.expires_in ?? payload.access_token_expires_in,
    refresh_expires_in: payload.refresh_token_expires_in,
  };
}

/** TikTok Business Organic (tt_user) — required for account comment API. */
export async function exchangeTikTokBusinessOrganicAuthCode(
  appId: string,
  appSecret: string,
  authCode: string,
  redirectUri?: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  open_id: string;
  scope?: string;
  expires_in?: number;
  refresh_expires_in?: number;
}> {
  const code = authCode.trim();
  const redirect = redirectUri?.trim() ?? "";
  if (!code) throw new Error("token_exchange_failed: missing auth_code");
  if (!redirect) throw new Error("token_exchange_failed: missing redirect_uri");

  // Account-holder flow: v2 authorize → tt_user/oauth2/token (not portal/auth + creator_token).
  // Single request — auth codes are single-use and expire in seconds.
  const body = {
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    auth_code: code,
    redirect_uri: redirect,
  };

  const res = await fetch(`${TIKTOK_BUSINESS_API_BASE}/tt_user/oauth2/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({})) as TikTokBusinessTokenExchangeResponse;
  const parsed = parseBusinessTokenExchangeResult(json);
  if (parsed) return parsed;

  const msg = json.message?.trim() || `HTTP ${res.status}`;
  const codeSuffix = json.code != null ? ` (code ${json.code})` : "";
  if (json.code === 40131) {
    throw new Error(
      `token_exchange_failed: ${msg}${codeSuffix}. Start Connect again from settings — do not refresh the callback URL.`,
    );
  }
  throw new Error(`token_exchange_failed: ${msg}${codeSuffix}`);
}

export async function refreshTikTokBusinessOrganicAccessToken(
  appId: string,
  appSecret: string,
  refreshToken: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  open_id?: string;
  expires_in?: number;
} | null> {
  const res = await fetch(`${TIKTOK_BUSINESS_API_BASE}/tt_user/oauth2/refresh_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const json = await res.json().catch(() => ({})) as TikTokBusinessApiResponse<TikTokBusinessOAuthTokenData>;
  const payload = parseTikTokBusinessOAuthTokenResponse(json);
  const accessToken = payload.access_token?.trim() ?? "";
  if (!res.ok || json.code !== 0 || !accessToken) {
    console.error("tiktok business organic refresh:", json.message ?? res.status);
    return null;
  }
  return {
    access_token: accessToken,
    refresh_token: payload.refresh_token?.trim() || undefined,
    open_id: payload.open_id?.trim() || undefined,
    expires_in: payload.expires_in ?? payload.access_token_expires_in,
  };
}

const BUSINESS_VIDEO_LIST_FIELDS = JSON.stringify([
  "item_id",
  "caption",
  "thumbnail_url",
  "share_url",
  "video_views",
  "likes",
  "comments",
  "shares",
  "create_time",
  "video_duration",
]);

type TikTokBusinessVideoRow = {
  item_id?: string | number;
  caption?: string;
  thumbnail_url?: string;
  share_url?: string;
  video_views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  create_time?: number;
  video_duration?: number;
};

function mapBusinessVideoRow(row: TikTokBusinessVideoRow): TikTokVideoRow {
  const rawCreate = Number(row.create_time ?? 0);
  const createTimeSec = rawCreate > 1_000_000_000_000
    ? Math.floor(rawCreate / 1000)
    : rawCreate;
  const itemId = pickBusinessSnowflakeId(row.item_id);
  return {
    id: itemId || undefined,
    title: normalizeTikTokCaptionFromApi(row.caption),
    video_description: normalizeTikTokCaptionFromApi(row.caption),
    cover_image_url: row.thumbnail_url ?? undefined,
    share_url: row.share_url ?? undefined,
    view_count: Number(row.video_views ?? 0),
    like_count: Number(row.likes ?? 0),
    comment_count: Number(row.comments ?? 0),
    share_count: Number(row.shares ?? 0),
    create_time: Number.isFinite(createTimeSec) && createTimeSec > 0 ? createTimeSec : undefined,
    duration: row.video_duration != null ? Number(row.video_duration) : undefined,
  };
}

export async function fetchTikTokBusinessVideoList(
  accessToken: string,
  businessId: string,
  cursor?: number,
  maxCount = 20,
): Promise<{ videos: TikTokVideoRow[]; cursor?: number; has_more: boolean }> {
  const params: Record<string, string | number | boolean> = {
    business_id: businessId,
    fields: BUSINESS_VIDEO_LIST_FIELDS,
    max_count: Math.min(maxCount, 20),
  };
  if (cursor != null && Number.isFinite(cursor) && cursor > 0) {
    params.cursor = cursor;
  }
  const data = await tiktokBusinessGet<{
    videos?: TikTokBusinessVideoRow[];
    list?: TikTokBusinessVideoRow[];
    cursor?: number;
    has_more?: boolean;
  }>(accessToken, "/business/video/list/", params);
  const raw = data.videos ?? data.list ?? [];
  return {
    videos: raw.map(mapBusinessVideoRow).filter((v) => v.id),
    cursor: data.cursor,
    has_more: Boolean(data.has_more),
  };
}

/** All account videos (newest-first pagination) — no post-date filter (Manage Comments inbox). */
export async function fetchAllTikTokBusinessVideos(
  accessToken: string,
  businessId: string,
  maxPages = 50,
): Promise<TikTokVideoRow[]> {
  const all: TikTokVideoRow[] = [];
  let cursor: number | undefined;
  let page = 0;

  while (page < maxPages) {
    const batch = await fetchTikTokBusinessVideoList(accessToken, businessId, cursor, 20);
    if (batch.videos.length === 0) break;
    all.push(...batch.videos);
    if (!batch.has_more || batch.cursor == null) break;
    cursor = batch.cursor;
    page += 1;
  }

  return all;
}

export async function fetchAllTikTokBusinessVideosInRange(
  accessToken: string,
  businessId: string,
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
    const batch = await fetchTikTokBusinessVideoList(accessToken, businessId, cursor, 20);
    const videos = batch.videos;
    if (videos.length === 0) break;

    let oldestInBatch = Infinity;
    for (const v of videos) {
      const ct = Number(v.create_time ?? 0) * 1000;
      if (Number.isFinite(ct)) oldestInBatch = Math.min(oldestInBatch, ct);
      if (!Number.isFinite(ct)) continue;
      if (ct >= startMs && ct <= endMs) all.push(v);
      if (ct < startMs) return all;
    }

    if (!batch.has_more || batch.cursor == null) break;
    if (Number.isFinite(oldestInBatch) && oldestInBatch < startMs) break;
    cursor = batch.cursor;
    page += 1;
  }

  return all;
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

/** All account videos (newest-first pagination) — no post-date filter (Manage Comments inbox). */
export async function fetchAllTikTokVideos(
  accessToken: string,
  maxPages = 50,
): Promise<TikTokVideoRow[]> {
  const all: TikTokVideoRow[] = [];
  let cursor: number | undefined;
  let page = 0;

  while (page < maxPages) {
    const batch = await fetchTikTokVideoList(accessToken, cursor, 20);
    if (batch.videos.length === 0) break;
    all.push(...batch.videos);
    if (!batch.has_more || batch.cursor == null) break;
    cursor = batch.cursor;
    page += 1;
  }

  return all;
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

function normalizeCommentRow(row: TikTokCommentApiRow) {
  const id = pickBusinessSnowflakeId(row.id) || String(row.id ?? "").trim();
  return {
    id,
    video_id: pickBusinessSnowflakeId(row.video_id) || undefined,
    text: String(row.text ?? ""),
    like_count: Number(row.like_count ?? 0),
    reply_count: Number(row.reply_count ?? 0),
    parent_comment_id: pickBusinessSnowflakeId(row.parent_comment_id) || null,
    create_time: row.create_time != null ? Number(row.create_time) : null,
    display_name: row.display_name?.trim() || undefined,
  };
}

type TikTokBusinessApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

type TikTokBusinessCommentListData = {
  comments?: TikTokCommentApiRow[];
  comment_list?: TikTokCommentApiRow[];
  list?: TikTokCommentApiRow[];
  cursor?: number;
  has_more?: boolean;
  page_info?: { cursor?: number; has_more?: boolean };
};

/** TikTok snowflake IDs exceed JS Number.MAX_SAFE_INTEGER when returned as bare JSON numbers. */
const TIKTOK_BUSINESS_SNOWFLAKE_KEY_PATTERN =
  /"(id|comment_id|video_id|item_id|parent_comment_id|reply_id|business_id)"\s*:\s*(\d{15,})/g;

function parseTikTokBusinessJsonResponse(text: string): TikTokBusinessApiResponse<unknown> {
  const patched = text.replace(
    TIKTOK_BUSINESS_SNOWFLAKE_KEY_PATTERN,
    (_match, key: string, digits: string) => `"${key}":"${digits}"`,
  );
  try {
    return JSON.parse(patched) as TikTokBusinessApiResponse<unknown>;
  } catch {
    return JSON.parse(text) as TikTokBusinessApiResponse<unknown>;
  }
}

function pickBusinessSnowflakeId(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value) || !Number.isSafeInteger(value)) continue;
      const digits = String(value);
      if (/^\d{10,}$/.test(digits)) return digits;
      continue;
    }
    const id = String(value).trim();
    if (!id || id === "0") continue;
    if (/e/i.test(id)) continue;
    if (/^\d{10,}$/.test(id)) return id;
  }
  return "";
}

function normalizeBusinessCommentRow(row: Record<string, unknown>): ReturnType<typeof normalizeCommentRow> {
  const nested = row.comment;
  const nestedRow = nested && typeof nested === "object"
    ? nested as Record<string, unknown>
    : null;
  return normalizeCommentRow({
    id: pickBusinessSnowflakeId(
      row.comment_id,
      row.reply_id,
      nestedRow?.comment_id,
      nestedRow?.reply_id,
      row.cid,
      row.id,
      nestedRow?.id,
    ) || undefined,
    video_id: pickBusinessSnowflakeId(row.video_id, row.item_id) || undefined,
    text: (row.text ?? row.content) as string | undefined,
    like_count: Number(row.like_count ?? row.likes ?? 0),
    reply_count: Number(row.reply_count ?? row.replies ?? 0),
    parent_comment_id: pickBusinessSnowflakeId(row.parent_comment_id) || null,
    create_time: row.create_time != null ? Number(row.create_time) : undefined,
    display_name: String(row.display_name ?? row.username ?? row.user_name ?? "").trim() || undefined,
  });
}

async function tiktokBusinessGet<T>(
  accessToken: string,
  path: string,
  params: Record<string, string | number | boolean>,
): Promise<T> {
  const url = new URL(`${TIKTOK_BUSINESS_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Access-Token": accessToken },
  });
  const text = await res.text();
  const json = text
    ? parseTikTokBusinessJsonResponse(text)
    : ({} as TikTokBusinessApiResponse<T>);
  if (!res.ok || json.code !== 0) {
    const msg = json.message?.trim() || `TikTok Business API HTTP ${res.status}`;
    const codeSuffix = json.code != null ? ` (code ${json.code})` : "";
    const reqSuffix = json.request_id ? ` [request_id=${json.request_id}]` : "";
    throw new Error(`${path}: ${msg}${codeSuffix}${reqSuffix}`);
  }
  return (json.data ?? {}) as T;
}

async function tiktokBusinessPost<T>(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${TIKTOK_BUSINESS_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = text
    ? parseTikTokBusinessJsonResponse(text)
    : ({} as TikTokBusinessApiResponse<T>);
  if (!res.ok || json.code !== 0) {
    const msg = json.message?.trim() || `TikTok Business API HTTP ${res.status}`;
    const codeSuffix = json.code != null ? ` (code ${json.code})` : "";
    const reqSuffix = json.request_id ? ` [request_id=${json.request_id}]` : "";
    throw new Error(`${path}: ${msg}${codeSuffix}${reqSuffix}`);
  }
  return json.data as T;
}

const BUSINESS_COMMENT_MAX_COUNT = 30;

function parseBusinessCommentList(data: TikTokBusinessCommentListData | null | undefined): {
  comments: ReturnType<typeof normalizeCommentRow>[];
  cursor: number | null;
  has_more: boolean;
} {
  const safe = data ?? {};
  const raw = safe.comments ?? safe.comment_list ?? safe.list ?? [];
  const comments = raw
    .map((row) => normalizeBusinessCommentRow(row as Record<string, unknown>))
    .filter((c) => c.id);
  const cursor = safe.cursor ?? safe.page_info?.cursor;
  const hasMore = Boolean(safe.has_more ?? safe.page_info?.has_more);
  return {
    comments,
    cursor: cursor != null && Number.isFinite(Number(cursor)) ? Number(cursor) : null,
    has_more: hasMore,
  };
}

const LOGIN_KIT_COMMENT_FIELDS = [
  "id",
  "video_id",
  "text",
  "like_count",
  "reply_count",
  "parent_comment_id",
  "create_time",
].join(",");

type LoginKitCommentListData = {
  comments?: TikTokCommentApiRow[];
  cursor?: number;
  has_more?: boolean;
};

function parseLoginKitCommentList(data: LoginKitCommentListData): {
  comments: ReturnType<typeof normalizeCommentRow>[];
  cursor: number | null;
  has_more: boolean;
} {
  const comments = (data.comments ?? [])
    .map((row) => normalizeCommentRow(row))
    .filter((c) => c.id);
  const cursor = data.cursor;
  return {
    comments,
    cursor: cursor != null && Number.isFinite(Number(cursor)) ? Number(cursor) : null,
    has_more: Boolean(data.has_more),
  };
}

async function fetchLoginKitCommentListPage(
  accessToken: string,
  path: string,
  method: "GET" | "POST",
  body: Record<string, unknown>,
): Promise<LoginKitCommentListData> {
  const url = `${TIKTOK_CONTENT_API_BASE}${path}?fields=${LOGIN_KIT_COMMENT_FIELDS}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const json = text
    ? parseTikTokBusinessJsonResponse(text) as TikTokContentEnvelope<LoginKitCommentListData>
    : ({} as TikTokContentEnvelope<LoginKitCommentListData>);
  if (!res.ok || json.error?.code !== "ok") {
    throwApiError(`login_kit${path}`, json.error, res.status);
  }
  return json.data ?? {};
}

async function fetchLoginKitVideoComments(
  accessToken: string,
  videoId: string,
  cursor: number,
  maxCount: number,
): Promise<{
  comments: ReturnType<typeof normalizeCommentRow>[];
  cursor: number | null;
  has_more: boolean;
}> {
  const body: Record<string, unknown> = {
    video_id: videoId,
    max_count: Math.min(maxCount, 50),
  };
  if (cursor > 0) body.cursor = cursor;

  const attempts: Array<() => Promise<LoginKitCommentListData>> = [
    () => fetchLoginKitCommentListPage(accessToken, "/video/comment/list/", "POST", body),
    () => fetchLoginKitCommentListPage(accessToken, "/comment/list/", "POST", body),
    () => fetchLoginKitCommentListPage(accessToken, "/video/comment/list/", "GET", body),
  ];

  let lastErr: Error | null = null;
  for (const attempt of attempts) {
    try {
      return parseLoginKitCommentList(await attempt());
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("login_kit_comment_list_failed");
}

async function fetchLoginKitCommentReplies(
  accessToken: string,
  videoId: string,
  commentId: string,
  cursor: number,
  maxCount: number,
): Promise<{
  comments: ReturnType<typeof normalizeCommentRow>[];
  cursor: number | null;
  has_more: boolean;
}> {
  const body: Record<string, unknown> = {
    video_id: videoId,
    comment_id: commentId,
    max_count: Math.min(maxCount, 50),
  };
  if (cursor > 0) body.cursor = cursor;

  const attempts: Array<() => Promise<LoginKitCommentListData>> = [
    () => fetchLoginKitCommentListPage(accessToken, "/video/comment/reply/list/", "POST", body),
    () => fetchLoginKitCommentListPage(accessToken, "/comment/reply/list/", "POST", body),
  ];

  let lastErr: Error | null = null;
  for (const attempt of attempts) {
    try {
      return parseLoginKitCommentList(await attempt());
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("login_kit_comment_reply_list_failed");
}

const BUSINESS_COMMENT_AUTH_HINT =
  "Hubungkan ulang: Settings → Disconnect → Connect (harus lewat business-api.tiktok.com, bukan login tiktok.com). App sudah approved.";

function enhanceBusinessCommentError(
  err: unknown,
  tokenKind: TikTokContentOAuthTokenKind,
): Error {
  const base = err instanceof Error ? err : new Error(String(err));
  if (tokenKind === TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.ttUser) return base;
  return new Error(`business_comment_auth_required: ${base.message}. ${BUSINESS_COMMENT_AUTH_HINT}`);
}

async function fetchBusinessAccountComments(
  accessToken: string,
  businessId: string,
  videoId: string,
  cursor: number,
  maxCount: number,
): Promise<{
  comments: ReturnType<typeof normalizeCommentRow>[];
  cursor: number | null;
  has_more: boolean;
}> {
  const base: Record<string, string | number | boolean> = {
    business_id: businessId,
    status: "PUBLIC",
    cursor: Math.max(0, cursor),
    max_count: Math.min(Math.max(1, maxCount), BUSINESS_COMMENT_MAX_COUNT),
  };

  const errors: string[] = [];
  for (const videoKey of ["video_id", "item_id"] as const) {
    try {
      const data = await tiktokBusinessGet<TikTokBusinessCommentListData>(
        accessToken,
        "/business/comment/list/",
        { ...base, [videoKey]: videoId },
      );
      return parseBusinessCommentList(data);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errors.join(" | "));
}

async function fetchBusinessAccountCommentReplies(
  accessToken: string,
  businessId: string,
  videoId: string,
  commentId: string,
  cursor: number,
  maxCount: number,
): Promise<{
  comments: ReturnType<typeof normalizeCommentRow>[];
  cursor: number | null;
  has_more: boolean;
}> {
  const body: Record<string, unknown> = {
    business_id: businessId,
    video_id: videoId,
    comment_id: commentId,
    status: "PUBLIC",
    cursor: Math.max(0, cursor),
    max_count: Math.min(Math.max(1, maxCount), BUSINESS_COMMENT_MAX_COUNT),
  };

  const data = await tiktokBusinessGet<TikTokBusinessCommentListData>(
    accessToken,
    "/business/comment/reply/list/",
    body as Record<string, string | number | boolean>,
  );
  return parseBusinessCommentList(data);
}

export async function fetchTikTokVideoComments(
  accessToken: string,
  businessId: string,
  videoId: string,
  cursor = 0,
  maxCount = 50,
  tokenKind: TikTokContentOAuthTokenKind = TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.loginKit,
): Promise<{
  comments: ReturnType<typeof normalizeCommentRow>[];
  cursor: number | null;
  has_more: boolean;
}> {
  try {
    return await fetchBusinessAccountComments(accessToken, businessId, videoId, cursor, maxCount);
  } catch (e) {
    throw enhanceBusinessCommentError(e, tokenKind);
  }
}

export async function fetchTikTokCommentReplies(
  accessToken: string,
  businessId: string,
  videoId: string,
  commentId: string,
  cursor = 0,
  maxCount = 50,
  tokenKind: TikTokContentOAuthTokenKind = TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.loginKit,
): Promise<{
  comments: ReturnType<typeof normalizeCommentRow>[];
  cursor: number | null;
  has_more: boolean;
}> {
  try {
    return await fetchBusinessAccountCommentReplies(
      accessToken,
      businessId,
      videoId,
      commentId,
      cursor,
      maxCount,
    );
  } catch (e) {
    throw enhanceBusinessCommentError(e, tokenKind);
  }
}

async function loginKitCommentPost(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${TIKTOK_CONTENT_API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = text
    ? parseTikTokBusinessJsonResponse(text) as TikTokContentEnvelope<Record<string, never>>
    : ({} as TikTokContentEnvelope<Record<string, never>>);
  if (!res.ok || json.error?.code !== "ok") {
    throwApiError(`login_kit${path}`, json.error, res.status);
  }
}

function formatBusinessCommentDeleteError(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  const lower = base.toLowerCase();
  if (
    lower.includes("40002")
    || lower.includes("invalid_params")
    || lower.includes("comment_id")
  ) {
    return (
      "Komentar ini tidak bisa dihapus di TikTok. "
      + "Hanya balasan/komentar dari akun Anda yang bisa dihapus — gunakan Hide untuk komentar pengguna lain."
    );
  }
  return base;
}

const TIKTOK_COMMENT_REPLY_MAX_LENGTH = 150;

function normalizeTikTokCommentReplyText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Reply text is required");
  if (trimmed.length > TIKTOK_COMMENT_REPLY_MAX_LENGTH) {
    throw new Error(`Reply must be at most ${TIKTOK_COMMENT_REPLY_MAX_LENGTH} characters`);
  }
  return trimmed;
}

export async function replyTikTokComment(
  accessToken: string,
  args: { businessId: string; videoId: string; text: string; commentId: string },
  tokenKind: TikTokContentOAuthTokenKind = TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.loginKit,
): Promise<{ comment_id?: string }> {
  const parentCommentId = args.commentId.trim();
  const videoId = args.videoId.trim();
  if (!parentCommentId) throw new Error("comment_id is required to reply");
  if (!videoId) throw new Error("video_id is required to reply");

  const replyText = normalizeTikTokCommentReplyText(args.text);
  const businessBody: Record<string, unknown> = {
    business_id: args.businessId,
    account_id: videoId,
    video_id: videoId,
    comment_id: parentCommentId,
    text: replyText,
  };

  try {
    const data = await tiktokBusinessPost<{
      comment_id?: string | number;
      reply_id?: string | number;
    }>(
      accessToken,
      "/business/comment/reply/create/",
      businessBody,
    );
    const replyId = pickBusinessSnowflakeId(data.reply_id, data.comment_id);
    return {
      comment_id: replyId || undefined,
    };
  } catch (e) {
    throw enhanceBusinessCommentError(e, tokenKind);
  }
}

function normalizeBusinessCommentId(commentId: string): string {
  const trimmed = commentId.trim();
  if (!trimmed) return trimmed;
  if (!/^\d{10,}$/.test(trimmed)) {
    throw new Error(
      `comment_id format is invalid (${trimmed}). Refresh the page to reload comments and try again.`,
    );
  }
  return trimmed;
}

function isRetryableBusinessCommentParamError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("40002")
    || lower.includes("invalid")
    || lower.includes("validate your param")
  );
}

async function postBusinessCommentActionWithFallbacks(
  accessToken: string,
  path: string,
  attempts: Record<string, unknown>[],
): Promise<void> {
  const errors: string[] = [];
  for (const body of attempts) {
    try {
      await tiktokBusinessPost<Record<string, never>>(accessToken, path, body);
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      if (!isRetryableBusinessCommentParamError(msg)) {
        throw e;
      }
    }
  }
  throw new Error(errors[errors.length - 1] ?? `${path}: request failed`);
}

export async function deleteTikTokComment(
  accessToken: string,
  args: {
    businessId: string;
    videoId?: string;
    commentId: string;
    parentCommentId?: string;
  },
  tokenKind: TikTokContentOAuthTokenKind = TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.loginKit,
): Promise<void> {
  const commentId = normalizeBusinessCommentId(args.commentId);
  if (!commentId) throw new Error("comment_id is required to delete");
  const videoId = args.videoId?.trim() ?? "";
  const parentCommentId = args.parentCommentId?.trim() ?? "";

  const attempts: Record<string, unknown>[] = [
    { business_id: args.businessId, comment_id: commentId },
  ];
  if (videoId) {
    attempts.push(
      { business_id: args.businessId, video_id: videoId, comment_id: commentId },
      { business_id: args.businessId, item_id: videoId, comment_id: commentId },
      {
        business_id: args.businessId,
        account_id: videoId,
        video_id: videoId,
        comment_id: commentId,
      },
    );
    if (parentCommentId) {
      attempts.push({
        business_id: args.businessId,
        video_id: videoId,
        comment_id: commentId,
        parent_comment_id: parentCommentId,
      });
    }
  }

  try {
    await postBusinessCommentActionWithFallbacks(
      accessToken,
      "/business/comment/delete/",
      attempts,
    );
  } catch (e) {
    throw new Error(formatBusinessCommentDeleteError(e));
  }
}

export async function hideTikTokComment(
  accessToken: string,
  args: { businessId: string; commentId: string; videoId: string },
  tokenKind: TikTokContentOAuthTokenKind = TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.loginKit,
): Promise<void> {
  const commentId = normalizeBusinessCommentId(args.commentId);
  const videoId = args.videoId.trim();
  if (!commentId || !videoId) throw new Error("comment_id and video_id are required to hide");

  const attempts: Record<string, unknown>[] = [
    {
      business_id: args.businessId,
      video_id: videoId,
      comment_id: commentId,
      action: "HIDE",
    },
    {
      business_id: args.businessId,
      item_id: videoId,
      comment_id: commentId,
      action: "HIDE",
    },
  ];

  try {
    await postBusinessCommentActionWithFallbacks(
      accessToken,
      "/business/comment/hide/",
      attempts,
    );
  } catch (e) {
    throw enhanceBusinessCommentError(e, tokenKind);
  }
}

export async function likeTikTokComment(
  accessToken: string,
  args: { businessId: string; commentId: string; action?: "LIKE" | "UNLIKE" },
  tokenKind: TikTokContentOAuthTokenKind = TIKTOK_CONTENT_OAUTH_TOKEN_KINDS.loginKit,
): Promise<void> {
  const commentId = normalizeBusinessCommentId(args.commentId);
  if (!commentId) throw new Error("comment_id is required to like");
  const action = args.action === "UNLIKE" ? "UNLIKE" : "LIKE";

  try {
    await tiktokBusinessPost<Record<string, never>>(
      accessToken,
      "/business/comment/like/",
      {
        business_id: args.businessId,
        comment_id: commentId,
        action,
      },
    );
  } catch (e) {
    throw enhanceBusinessCommentError(e, tokenKind);
  }
}
