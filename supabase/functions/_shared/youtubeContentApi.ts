const YOUTUBE_DATA_API = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type YouTubeChannelRow = {
  channel_id: string;
  title: string;
  thumbnail_url: string | null;
  uploads_playlist_id: string | null;
};

export type YouTubeVideoPrivacyStatus = "public" | "unlisted" | "private";

export type YouTubeVideoRow = {
  id?: string;
  title?: string;
  published_at?: string;
  thumbnail_url?: string | null;
  privacy_status?: YouTubeVideoPrivacyStatus | null;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  subscribers_gained?: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function throwGoogleError(prefix: string, json: GoogleTokenResponse, httpStatus: number): never {
  const msg = json.error_description?.trim() || json.error?.trim() || `${prefix} HTTP ${httpStatus}`;
  throw new Error(msg);
}

export async function exchangeYouTubeContentAuthCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: decodeURIComponent(code),
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({})) as GoogleTokenResponse;
  const accessToken = json.access_token?.trim() ?? "";
  const refreshToken = json.refresh_token?.trim() ?? "";
  if (!res.ok || !accessToken) {
    throwGoogleError("token_exchange_failed", json, res.status);
  }
  return {
    access_token: accessToken,
    refresh_token: refreshToken || accessToken,
    expires_in: json.expires_in,
  };
}

export async function refreshYouTubeContentAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
} | null> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({})) as GoogleTokenResponse;
  const accessToken = json.access_token?.trim() ?? "";
  if (!res.ok || !accessToken) {
    console.error("youtube content refresh:", json.error_description ?? json.error ?? res.status);
    return null;
  }
  return {
    access_token: accessToken,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
  };
}

type YouTubeApiError = {
  error?: {
    message?: string;
    code?: number;
    errors?: Array<{ reason?: string; message?: string }>;
  };
};

async function youtubeDataGet<T>(
  accessToken: string,
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${YOUTUBE_DATA_API}${path}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as T & YouTubeApiError;
  if (!res.ok) {
    const msg = json.error?.message ?? `YouTube API HTTP ${res.status}`;
    const reason = json.error?.errors?.[0]?.reason;
    const detail = reason ? `${msg} (${reason})` : msg;
    throw new Error(`YouTube ${path} HTTP ${res.status}: ${detail}`);
  }
  return json;
}

async function youtubeDataPost<T>(
  accessToken: string,
  path: string,
  params: Record<string, string>,
  body: object,
): Promise<T> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${YOUTUBE_DATA_API}${path}?${qs.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({})) as T & YouTubeApiError;
  if (!res.ok) {
    const msg = json.error?.message ?? `YouTube API HTTP ${res.status}`;
    const reason = json.error?.errors?.[0]?.reason;
    const detail = reason ? `${msg} (${reason})` : msg;
    throw new Error(`YouTube ${path} HTTP ${res.status}: ${detail}`);
  }
  return json;
}

export async function fetchYouTubeChannelsMine(accessToken: string): Promise<YouTubeChannelRow[]> {
  const json = await youtubeDataGet<{
    items?: Array<{
      id?: string;
      snippet?: { title?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  }>(accessToken, "/channels", {
    part: "snippet,contentDetails",
    mine: "true",
    maxResults: "50",
  });

  return (json.items ?? []).map((item) => {
    const channelId = String(item.id ?? "").trim();
    const thumbs = item.snippet?.thumbnails;
    const thumb = thumbs?.medium?.url ?? thumbs?.default?.url ?? null;
    return {
      channel_id: channelId,
      title: String(item.snippet?.title ?? "").trim() || channelId,
      thumbnail_url: thumb,
      uploads_playlist_id: item.contentDetails?.relatedPlaylists?.uploads ?? null,
    };
  }).filter((c) => c.channel_id);
}

export function buildYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function normalizeYouTubePrivacyStatus(
  raw: string | undefined,
): YouTubeVideoPrivacyStatus | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "public" || value === "unlisted" || value === "private") {
    return value;
  }
  return null;
}

/** Owner OAuth token can read public, unlisted, and private uploads on the connected channel. */
async function fetchVideoStatistics(
  accessToken: string,
  videoIds: string[],
): Promise<Map<string, YouTubeVideoRow>> {
  const map = new Map<string, YouTubeVideoRow>();
  if (videoIds.length === 0) return map;

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const json = await youtubeDataGet<{
      items?: Array<{
        id?: string;
        snippet?: {
          title?: string;
          publishedAt?: string;
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        };
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
        status?: { privacyStatus?: string };
      }>;
    }>(accessToken, "/videos", {
      part: "snippet,statistics,status",
      id: batch.join(","),
      maxResults: "50",
    });

    for (const item of json.items ?? []) {
      const id = String(item.id ?? "").trim();
      if (!id) continue;
      const thumbs = item.snippet?.thumbnails;
      map.set(id, {
        id,
        title: item.snippet?.title ?? "",
        published_at: item.snippet?.publishedAt,
        thumbnail_url: thumbs?.medium?.url ?? thumbs?.default?.url ?? null,
        privacy_status: normalizeYouTubePrivacyStatus(item.status?.privacyStatus),
        view_count: Number(item.statistics?.viewCount ?? 0) || 0,
        like_count: Number(item.statistics?.likeCount ?? 0) || 0,
        comment_count: Number(item.statistics?.commentCount ?? 0) || 0,
        share_count: 0,
      });
    }
  }
  return map;
}

async function fetchVideoSubscribersGainedInRange(
  accessToken: string,
  channelId: string,
  videoIds: string[],
  dateStartYmd: string,
  dateEndYmd: string,
): Promise<Map<string, number>> {
  const gained = new Map<string, number>();
  if (videoIds.length === 0) return gained;

  try {
    for (let i = 0; i < videoIds.length; i += 200) {
      const batch = videoIds.slice(i, i + 200);
      const params = new URLSearchParams({
        ids: `channel==${channelId}`,
        startDate: dateStartYmd,
        endDate: dateEndYmd,
        dimensions: "video",
        metrics: "subscribersGained",
        filters: `video==${batch.join(",")}`,
        maxResults: "200",
      });
      const res = await fetch(`${YOUTUBE_ANALYTICS_API}/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json().catch(() => ({})) as {
        rows?: Array<[string, number]>;
        error?: { message?: string };
      };
      if (!res.ok) {
        console.warn("youtube analytics subscribersGained:", json.error?.message ?? res.status);
        return gained;
      }
      for (const row of json.rows ?? []) {
        const vid = String(row[0] ?? "").trim();
        const count = Number(row[1] ?? 0) || 0;
        if (vid) gained.set(vid, count);
      }
    }
  } catch (e) {
    console.warn("youtube analytics subscribersGained error:", e);
  }
  return gained;
}

async function fetchVideoSharesInRange(
  accessToken: string,
  channelId: string,
  videoIds: string[],
  dateStartYmd: string,
  dateEndYmd: string,
): Promise<Map<string, number>> {
  const shares = new Map<string, number>();
  if (videoIds.length === 0) return shares;

  try {
    for (let i = 0; i < videoIds.length; i += 200) {
      const batch = videoIds.slice(i, i + 200);
      const params = new URLSearchParams({
        ids: `channel==${channelId}`,
        startDate: dateStartYmd,
        endDate: dateEndYmd,
        dimensions: "video",
        metrics: "shares",
        filters: `video==${batch.join(",")}`,
        maxResults: "200",
      });
      const res = await fetch(`${YOUTUBE_ANALYTICS_API}/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json().catch(() => ({})) as {
        rows?: Array<[string, number]>;
        error?: { message?: string };
      };
      if (!res.ok) {
        console.warn("youtube analytics shares:", json.error?.message ?? res.status);
        return shares;
      }
      for (const row of json.rows ?? []) {
        const vid = String(row[0] ?? "").trim();
        const count = Number(row[1] ?? 0) || 0;
        if (vid) shares.set(vid, count);
      }
    }
  } catch (e) {
    console.warn("youtube analytics shares error:", e);
  }
  return shares;
}

export async function fetchAllYouTubeVideosInRange(
  accessToken: string,
  channelId: string,
  uploadsPlaylistId: string,
  dateStartYmd: string,
  dateEndYmd: string,
  maxPages = 40,
): Promise<YouTubeVideoRow[]> {
  const startMs = new Date(`${dateStartYmd}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${dateEndYmd}T23:59:59.999Z`).getTime();
  const videoIdsInRange: string[] = [];
  let pageToken = "";

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const json = await youtubeDataGet<{
      items?: Array<{ contentDetails?: { videoId?: string }; snippet?: { publishedAt?: string } }>;
      nextPageToken?: string;
    }>(accessToken, "/playlistItems", params);

    const items = json.items ?? [];
    if (items.length === 0) break;

    let oldestInBatch = Infinity;
    for (const item of items) {
      const vid = String(item.contentDetails?.videoId ?? "").trim();
      const published = item.snippet?.publishedAt;
      const pubMs = published ? new Date(published).getTime() : NaN;
      if (!vid || !Number.isFinite(pubMs)) continue;
      oldestInBatch = Math.min(oldestInBatch, pubMs);
      if (pubMs >= startMs && pubMs <= endMs) videoIdsInRange.push(vid);
      if (pubMs < startMs) {
        page = maxPages;
        break;
      }
    }

    if (!json.nextPageToken) break;
    if (Number.isFinite(oldestInBatch) && oldestInBatch < startMs) break;
    pageToken = json.nextPageToken;
  }

  const uniqueIds = [...new Set(videoIdsInRange)];
  return enrichYouTubeVideosWithMetrics(
    accessToken,
    channelId,
    uniqueIds,
    dateStartYmd,
    dateEndYmd,
  );
}

/** Paginate the full uploads playlist and return all owner-visible videos (no publish-date cutoff). */
export async function fetchAllYouTubeVideos(
  accessToken: string,
  channelId: string,
  uploadsPlaylistId: string,
  dateStartYmd: string,
  dateEndYmd: string,
  maxPages = 100,
): Promise<YouTubeVideoRow[]> {
  const videoIds: string[] = [];
  let pageToken = "";

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const json = await youtubeDataGet<{
      items?: Array<{ contentDetails?: { videoId?: string } }>;
      nextPageToken?: string;
    }>(accessToken, "/playlistItems", params);

    const items = json.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const vid = String(item.contentDetails?.videoId ?? "").trim();
      if (vid) videoIds.push(vid);
    }

    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }

  const uniqueIds = [...new Set(videoIds)];
  return enrichYouTubeVideosWithMetrics(
    accessToken,
    channelId,
    uniqueIds,
    dateStartYmd,
    dateEndYmd,
  );
}

async function enrichYouTubeVideosWithMetrics(
  accessToken: string,
  channelId: string,
  videoIds: string[],
  dateStartYmd: string,
  dateEndYmd: string,
): Promise<YouTubeVideoRow[]> {
  if (videoIds.length === 0) return [];

  const statsMap = await fetchVideoStatistics(accessToken, videoIds);
  const resolvedIds = videoIds.filter((id) => statsMap.has(id));
  const [sharesMap, subscribersGainedMap] = await Promise.all([
    fetchVideoSharesInRange(accessToken, channelId, resolvedIds, dateStartYmd, dateEndYmd),
    fetchVideoSubscribersGainedInRange(accessToken, channelId, resolvedIds, dateStartYmd, dateEndYmd),
  ]);

  const videos: YouTubeVideoRow[] = [];
  for (const id of resolvedIds) {
    const row = statsMap.get(id);
    if (!row) continue;
    videos.push({
      ...row,
      share_count: sharesMap.get(id) ?? 0,
      subscribers_gained: subscribersGainedMap.get(id) ?? 0,
    });
  }

  videos.sort((a, b) => {
    const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
    const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
    return tb - ta;
  });

  return videos;
}

/** Current total subscriber count for the channel (null if hidden by channel owner). */
export async function fetchChannelSubscriberCount(
  accessToken: string,
  channelId: string,
): Promise<number | null> {
  const json = await youtubeDataGet<{
    items?: Array<{
      statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
    }>;
  }>(accessToken, "/channels", {
    part: "statistics",
    id: channelId,
  });
  const stats = json.items?.[0]?.statistics;
  if (stats?.hiddenSubscriberCount) return null;
  const n = Number(stats?.subscriberCount ?? NaN);
  return Number.isFinite(n) ? n : null;
}

export async function resolveUploadsPlaylistId(
  accessToken: string,
  channelId: string,
): Promise<string | null> {
  const json = await youtubeDataGet<{
    items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
  }>(accessToken, "/channels", {
    part: "contentDetails",
    id: channelId,
  });
  return json.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

export type YouTubeCommentApiRow = {
  id: string;
  video_id: string;
  text: string;
  author_display_name: string;
  author_avatar_url: string | null;
  author_channel_id: string | null;
  like_count: number;
  reply_count: number;
  parent_comment_id: string | null;
  published_at: string | null;
  is_channel_owner: boolean;
  /** commentThread id — required as parentId when replying to a top-level comment */
  thread_id?: string | null;
  /** Value for comments.insert snippet.parentId */
  reply_parent_id?: string | null;
  can_reply?: boolean;
};

type YouTubeCommentSnippet = {
  authorDisplayName?: unknown;
  authorProfileImageUrl?: unknown;
  authorChannelId?: unknown;
  textDisplay?: unknown;
  textOriginal?: unknown;
  publishedAt?: unknown;
  likeCount?: unknown;
  totalReplyCount?: unknown;
  parentId?: unknown;
  videoId?: unknown;
};

function coerceOptionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["channelId", "id", "value"]) {
      const nested = coerceOptionalString(record[key]);
      if (nested) return nested;
    }
  }
  return null;
}

function coerceString(value: unknown, fallback = ""): string {
  return coerceOptionalString(value) ?? fallback;
}

function mapYouTubeCommentSnippet(
  commentId: string,
  videoId: string,
  snippet: YouTubeCommentSnippet | undefined,
  channelId: string,
  parentCommentId: string | null,
): YouTubeCommentApiRow {
  const authorChannelId = coerceOptionalString(snippet?.authorChannelId);
  const text = coerceString(snippet?.textDisplay) || coerceString(snippet?.textOriginal);
  return {
    id: commentId,
    video_id: videoId,
    text,
    author_display_name: coerceString(snippet?.authorDisplayName, "YouTube user"),
    author_avatar_url: coerceOptionalString(snippet?.authorProfileImageUrl),
    author_channel_id: authorChannelId,
    like_count: Number(snippet?.likeCount ?? 0) || 0,
    reply_count: Number(snippet?.totalReplyCount ?? 0) || 0,
    parent_comment_id: parentCommentId,
    published_at: coerceOptionalString(snippet?.publishedAt),
    is_channel_owner: Boolean(authorChannelId && authorChannelId === channelId.trim()),
  };
}

type CommentThreadItem = {
  id?: string;
  snippet?: {
    topLevelComment?: { id?: string; snippet?: YouTubeCommentSnippet };
    videoId?: string;
    canReply?: boolean;
    totalReplyCount?: unknown;
  };
};

function isYouTubeCommentsAccessError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return msg.includes("http 403")
    || msg.includes("403")
    || msg.includes("insufficient")
    || msg.includes("forbidden")
    || msg.includes("commentsdisabled")
    || msg.includes("comments disabled");
}

export async function fetchGoogleTokenScopes(accessToken: string): Promise<string[]> {
  const res = await fetch(
    `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  );
  const json = await res.json().catch(() => ({})) as { scope?: string; error?: string };
  if (!res.ok || json.error) return [];
  return String(json.scope ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function verifyYouTubeVideoOwnedByChannel(
  accessToken: string,
  videoId: string,
  channelId: string,
): Promise<string | null> {
  const json = await youtubeDataGet<{
    items?: Array<{ snippet?: { channelId?: string; title?: string } }>;
  }>(accessToken, "/videos", {
    part: "snippet",
    id: videoId.trim(),
  });
  const ownerChannelId = String(json.items?.[0]?.snippet?.channelId ?? "").trim();
  if (!ownerChannelId) {
    return "Video not found or is not accessible with the connected Google account.";
  }
  if (ownerChannelId !== channelId.trim()) {
    return `This video belongs to YouTube channel ${ownerChannelId}, not the selected channel ${channelId}. Switch channel in the left sidebar.`;
  }
  return null;
}

function parseCommentThreadItems(
  items: CommentThreadItem[] | undefined,
  channelId: string,
  fallbackVideoId: string,
  filterVideoId?: string,
): YouTubeCommentApiRow[] {
  const all: YouTubeCommentApiRow[] = [];
  for (const thread of items ?? []) {
    const top = thread.snippet?.topLevelComment;
    const threadId = String(thread.id ?? "").trim();
    const topId = String(top?.id ?? "").trim();
    const vid = String(thread.snippet?.videoId ?? fallbackVideoId).trim();
    if (!topId) continue;
    if (filterVideoId && vid !== filterVideoId.trim()) continue;
    const totalReplyCount = Number(thread.snippet?.totalReplyCount ?? 0) || 0;
    all.push({
      ...mapYouTubeCommentSnippet(topId, vid, top?.snippet, channelId, null),
      reply_count: totalReplyCount,
      thread_id: threadId || null,
      // YouTube expects commentThread id as parentId for top-level replies.
      reply_parent_id: threadId || topId,
      can_reply: thread.snippet?.canReply !== false,
    });
  }
  return all;
}

async function fetchCommentThreadPages(
  accessToken: string,
  paramsBase: Record<string, string>,
  channelId: string,
  videoId: string,
  maxResults: number,
  options?: { filterVideoId?: string; maxPages?: number },
): Promise<YouTubeCommentApiRow[]> {
  const all: YouTubeCommentApiRow[] = [];
  const filterVideoId = options?.filterVideoId;
  const maxPages = options?.maxPages ?? 20;
  let pageToken = "";
  let emptyFilteredPages = 0;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      part: "snippet",
      textFormat: "plainText",
      maxResults: String(Math.min(maxResults, 100)),
      ...paramsBase,
    };
    if (pageToken) params.pageToken = pageToken;

    const json = await youtubeDataGet<{
      items?: CommentThreadItem[];
      nextPageToken?: string;
    }>(accessToken, "/commentThreads", params);

    const pageRows = parseCommentThreadItems(json.items, channelId, videoId, filterVideoId);
    if (filterVideoId) {
      if (pageRows.length === 0) {
        emptyFilteredPages += 1;
      } else {
        emptyFilteredPages = 0;
        all.push(...pageRows);
      }
      if (emptyFilteredPages >= 3 && all.length > 0) break;
    } else {
      all.push(...pageRows);
    }

    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
    if (!filterVideoId && all.length >= maxResults) break;
  }

  return all;
}

export async function fetchYouTubeCommentThreads(
  accessToken: string,
  channelId: string,
  videoId: string,
  maxResults = 100,
): Promise<YouTubeCommentApiRow[]> {
  const trimmedVideoId = videoId.trim();
  const trimmedChannelId = channelId.trim();

  const ownershipIssue = await verifyYouTubeVideoOwnedByChannel(
    accessToken,
    trimmedVideoId,
    trimmedChannelId,
  ).catch(() => null);
  if (ownershipIssue) {
    throw new Error(ownershipIssue);
  }

  try {
    return await fetchCommentThreadPages(
      accessToken,
      { videoId: trimmedVideoId, order: "time" },
      trimmedChannelId,
      trimmedVideoId,
      maxResults,
    );
  } catch (e) {
    if (!isYouTubeCommentsAccessError(e)) throw e;
    return await fetchCommentThreadPages(
      accessToken,
      { allThreadsRelatedToChannelId: trimmedChannelId, order: "time" },
      trimmedChannelId,
      trimmedVideoId,
      maxResults,
      { filterVideoId: trimmedVideoId, maxPages: 25 },
    );
  }
}

export async function fetchYouTubeCommentReplies(
  accessToken: string,
  channelId: string,
  parentCommentId: string,
  maxResults = 100,
): Promise<YouTubeCommentApiRow[]> {
  const all: YouTubeCommentApiRow[] = [];
  let pageToken = "";

  for (let page = 0; page < 20; page++) {
    const params: Record<string, string> = {
      part: "snippet",
      parentId: parentCommentId.trim(),
      textFormat: "plainText",
      maxResults: String(Math.min(maxResults, 100)),
    };
    if (pageToken) params.pageToken = pageToken;

    const json = await youtubeDataGet<{
      items?: Array<{ id?: string; snippet?: YouTubeCommentSnippet }>;
      nextPageToken?: string;
    }>(accessToken, "/comments", params);

    for (const item of json.items ?? []) {
      const id = String(item.id ?? "").trim();
      if (!id) continue;
      const vid = String(item.snippet?.videoId ?? "").trim();
      const snippet = item.snippet;
      all.push({
        ...mapYouTubeCommentSnippet(
          id,
          vid,
          snippet,
          channelId,
          coerceOptionalString(snippet?.parentId) ?? parentCommentId.trim(),
        ),
        reply_parent_id: id,
        can_reply: true,
      });
    }

    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }

  return all;
}

async function lookupCommentThreadIdByTopLevelComment(
  accessToken: string,
  channelId: string,
  videoId: string,
  topLevelCommentId: string,
): Promise<string | null> {
  const needle = topLevelCommentId.trim();
  if (!needle) return null;
  try {
    const threads = await fetchCommentThreadPages(
      accessToken,
      { videoId: videoId.trim(), order: "time" },
      channelId.trim(),
      videoId.trim(),
      100,
      { maxPages: 15 },
    );
    for (const row of threads) {
      if (row.id === needle) {
        return row.thread_id ?? null;
      }
    }
  } catch (e) {
    console.warn("lookupCommentThreadIdByTopLevelComment:", e instanceof Error ? e.message : e);
  }
  return null;
}

async function insertYouTubeCommentReplyOnce(
  accessToken: string,
  parentId: string,
  text: string,
): Promise<{ id: string; snippet?: YouTubeCommentSnippet }> {
  return youtubeDataPost<{ id?: string; snippet?: YouTubeCommentSnippet }>(
    accessToken,
    "/comments",
    { part: "snippet" },
    {
      snippet: {
        parentId: parentId.trim(),
        textOriginal: text.trim(),
      },
    },
  );
}

export async function insertYouTubeCommentReply(
  accessToken: string,
  channelId: string,
  videoId: string,
  targetCommentId: string,
  text: string,
  opts?: {
    threadId?: string | null;
    /** Top-level comment id in the thread (required when replying to a nested reply). */
    topLevelCommentId?: string | null;
  },
): Promise<YouTubeCommentApiRow> {
  const trimmedVideoId = videoId.trim();
  const trimmedChannelId = channelId.trim();
  const trimmedTargetId = targetCommentId.trim();
  const trimmedText = text.trim();
  if (!trimmedVideoId || !trimmedTargetId || !trimmedText) {
    throw new Error("Missing video_id, parent comment, or reply text");
  }

  const ownershipIssue = await verifyYouTubeVideoOwnedByChannel(
    accessToken,
    trimmedVideoId,
    trimmedChannelId,
  );
  if (ownershipIssue) {
    throw new Error(ownershipIssue);
  }

  // YouTube comments.insert only supports replies to top-level comments.
  // parentId must always be the commentThread id, even when the UI targets a nested reply.
  const topLevelCommentId = String(opts?.topLevelCommentId ?? "").trim() || trimmedTargetId;
  let threadId = String(opts?.threadId ?? "").trim();
  if (!threadId) {
    threadId = await lookupCommentThreadIdByTopLevelComment(
      accessToken,
      trimmedChannelId,
      trimmedVideoId,
      topLevelCommentId,
    ) ?? "";
  }
  if (!threadId) {
    throw new Error("Could not resolve comment thread for this reply. Refresh comments and try again.");
  }

  const json = await insertYouTubeCommentReplyOnce(
    accessToken,
    threadId,
    trimmedText,
  );
  const id = String(json.id ?? "").trim();
  if (!id) {
    throw new Error("YouTube did not return a comment id for the reply");
  }
  return {
    ...mapYouTubeCommentSnippet(
      id,
      trimmedVideoId,
      json.snippet,
      trimmedChannelId,
      topLevelCommentId,
    ),
    thread_id: threadId,
    reply_parent_id: threadId,
    can_reply: true,
  };
}
