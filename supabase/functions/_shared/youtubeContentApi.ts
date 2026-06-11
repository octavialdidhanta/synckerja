const YOUTUBE_DATA_API = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type YouTubeChannelRow = {
  channel_id: string;
  title: string;
  thumbnail_url: string | null;
  uploads_playlist_id: string | null;
};

export type YouTubeVideoRow = {
  id?: string;
  title?: string;
  published_at?: string;
  thumbnail_url?: string | null;
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

type YouTubeApiError = { error?: { message?: string; code?: number } };

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
    throw new Error(msg);
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
      }>;
    }>(accessToken, "/videos", {
      part: "snippet,statistics",
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
  const statsMap = await fetchVideoStatistics(accessToken, uniqueIds);
  const [sharesMap, subscribersGainedMap] = await Promise.all([
    fetchVideoSharesInRange(accessToken, channelId, uniqueIds, dateStartYmd, dateEndYmd),
    fetchVideoSubscribersGainedInRange(accessToken, channelId, uniqueIds, dateStartYmd, dateEndYmd),
  ]);

  const videos: YouTubeVideoRow[] = [];
  for (const id of uniqueIds) {
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
