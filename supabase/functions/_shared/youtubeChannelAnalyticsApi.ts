const YOUTUBE_ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";

export type YouTubeChannelAnalyticsOverview = {
  views: number;
  estimated_minutes_watched: number;
  average_view_duration_seconds: number | null;
  subscribers_gained: number;
  subscribers_lost: number;
};

export type YouTubeChannelDemographicsRow = {
  age_group: string;
  gender: string;
  viewer_percentage: number;
};

export type YouTubeChannelTrafficSourceRow = {
  source_type: string;
  source_label: string;
  views: number;
  estimated_minutes_watched: number;
};

export type YouTubeChannelDailyTrendRow = {
  date: string;
  views: number;
  estimated_minutes_watched: number;
};

export type YouTubeChannelAnalyticsBundle = {
  overview: YouTubeChannelAnalyticsOverview;
  demographics: YouTubeChannelDemographicsRow[];
  traffic_sources: YouTubeChannelTrafficSourceRow[];
  daily_trend: YouTubeChannelDailyTrendRow[];
};

/** i18n key suffix under digitalMarketing.youtubeContent.analytics.traffic.source.* */
export const YOUTUBE_TRAFFIC_SOURCE_LABEL_KEYS: Record<string, string> = {
  ADVERTISING: "ADVERTISING",
  ANNOTATION: "ANNOTATION",
  CAMPAIGN_CARD: "CAMPAIGN_CARD",
  END_SCREEN: "END_SCREEN",
  EXT_URL: "EXT_URL",
  HASHTAGS: "HASHTAGS",
  LIVE_REDIRECT: "LIVE_REDIRECT",
  NO_LINK_EMBEDDED: "NO_LINK_EMBEDDED",
  NOTIFICATION: "NOTIFICATION",
  PLAYLIST: "PLAYLIST",
  PRODUCT_PAGE: "PRODUCT_PAGE",
  PROMOTED: "PROMOTED",
  RELATED_VIDEO: "RELATED_VIDEO",
  SHORTS: "SHORTS",
  SOUND_PAGE: "SOUND_PAGE",
  SUBSCRIBER: "SUBSCRIBER",
  YT_CHANNEL: "YT_CHANNEL",
  YT_OTHER_PAGE: "YT_OTHER_PAGE",
  YT_SEARCH: "YT_SEARCH",
};

export class YouTubeAnalyticsForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeAnalyticsForbiddenError";
  }
}

type AnalyticsReportResponse = {
  columnHeaders?: Array<{ name?: string; columnType?: string; dataType?: string }>;
  rows?: Array<Array<string | number>>;
  error?: { message?: string; code?: number };
};

function isAnalyticsForbidden(message: string, status: number): boolean {
  const lower = message.toLowerCase();
  return status === 403
    || lower.includes("403")
    || lower.includes("forbidden")
    || lower.includes("insufficient")
    || lower.includes("not authorized");
}

async function youtubeAnalyticsReport(
  accessToken: string,
  channelId: string,
  dateStartYmd: string,
  dateEndYmd: string,
  dimensions: string | undefined,
  metrics: string,
): Promise<AnalyticsReportResponse> {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: dateStartYmd,
    endDate: dateEndYmd,
    metrics,
    maxResults: "200",
  });
  if (dimensions) params.set("dimensions", dimensions);
  const res = await fetch(`${YOUTUBE_ANALYTICS_API}/reports?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as AnalyticsReportResponse;
  if (!res.ok) {
    const msg = json.error?.message ?? `YouTube Analytics HTTP ${res.status}`;
    if (isAnalyticsForbidden(msg, res.status)) {
      throw new YouTubeAnalyticsForbiddenError(msg);
    }
    console.warn(`youtube channel analytics [${dimensions ?? "overview"}]:`, msg);
    return { rows: [] };
  }
  return json;
}

function columnIndex(headers: AnalyticsReportResponse["columnHeaders"], name: string): number {
  return (headers ?? []).findIndex((h) => h.name === name);
}

function emptyOverview(): YouTubeChannelAnalyticsOverview {
  return {
    views: 0,
    estimated_minutes_watched: 0,
    average_view_duration_seconds: null,
    subscribers_gained: 0,
    subscribers_lost: 0,
  };
}

export async function fetchChannelAnalyticsOverview(
  accessToken: string,
  channelId: string,
  dateStartYmd: string,
  dateEndYmd: string,
): Promise<YouTubeChannelAnalyticsOverview> {
  const json = await youtubeAnalyticsReport(
    accessToken,
    channelId,
    dateStartYmd,
    dateEndYmd,
    undefined,
    "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost",
  );
  const row = json.rows?.[0];
  if (!row) return emptyOverview();
  const headers = json.columnHeaders ?? [];
  const idx = (name: string) => columnIndex(headers, name);
  const avgRaw = Number(row[idx("averageViewDuration")] ?? NaN);
  return {
    views: Number(row[idx("views")] ?? 0) || 0,
    estimated_minutes_watched: Number(row[idx("estimatedMinutesWatched")] ?? 0) || 0,
    average_view_duration_seconds: Number.isFinite(avgRaw) ? avgRaw : null,
    subscribers_gained: Number(row[idx("subscribersGained")] ?? 0) || 0,
    subscribers_lost: Number(row[idx("subscribersLost")] ?? 0) || 0,
  };
}

export async function fetchChannelDemographics(
  accessToken: string,
  channelId: string,
  dateStartYmd: string,
  dateEndYmd: string,
): Promise<YouTubeChannelDemographicsRow[]> {
  const json = await youtubeAnalyticsReport(
    accessToken,
    channelId,
    dateStartYmd,
    dateEndYmd,
    "ageGroup,gender",
    "viewerPercentage",
  );
  const headers = json.columnHeaders ?? [];
  const ageIdx = columnIndex(headers, "ageGroup");
  const genderIdx = columnIndex(headers, "gender");
  const pctIdx = columnIndex(headers, "viewerPercentage");
  const rows: YouTubeChannelDemographicsRow[] = [];
  for (const row of json.rows ?? []) {
    const age_group = String(row[ageIdx] ?? "").trim();
    const gender = String(row[genderIdx] ?? "").trim();
    if (!age_group || !gender) continue;
    rows.push({
      age_group,
      gender,
      viewer_percentage: Number(row[pctIdx] ?? 0) || 0,
    });
  }
  return rows;
}

function trafficSourceLabelKey(sourceType: string): string {
  const key = sourceType.trim().toUpperCase();
  return YOUTUBE_TRAFFIC_SOURCE_LABEL_KEYS[key] ?? key;
}

export async function fetchChannelTrafficSources(
  accessToken: string,
  channelId: string,
  dateStartYmd: string,
  dateEndYmd: string,
): Promise<YouTubeChannelTrafficSourceRow[]> {
  const json = await youtubeAnalyticsReport(
    accessToken,
    channelId,
    dateStartYmd,
    dateEndYmd,
    "insightTrafficSourceType",
    "views,estimatedMinutesWatched",
  );
  const headers = json.columnHeaders ?? [];
  const sourceIdx = columnIndex(headers, "insightTrafficSourceType");
  const viewsIdx = columnIndex(headers, "views");
  const minutesIdx = columnIndex(headers, "estimatedMinutesWatched");
  const rows: YouTubeChannelTrafficSourceRow[] = [];
  for (const row of json.rows ?? []) {
    const source_type = String(row[sourceIdx] ?? "").trim();
    if (!source_type) continue;
    rows.push({
      source_type,
      source_label: trafficSourceLabelKey(source_type),
      views: Number(row[viewsIdx] ?? 0) || 0,
      estimated_minutes_watched: Number(row[minutesIdx] ?? 0) || 0,
    });
  }
  rows.sort((a, b) => b.views - a.views);
  return rows;
}

export async function fetchChannelDailyTrend(
  accessToken: string,
  channelId: string,
  dateStartYmd: string,
  dateEndYmd: string,
): Promise<YouTubeChannelDailyTrendRow[]> {
  const json = await youtubeAnalyticsReport(
    accessToken,
    channelId,
    dateStartYmd,
    dateEndYmd,
    "day",
    "views,estimatedMinutesWatched",
  );
  const headers = json.columnHeaders ?? [];
  const dayIdx = columnIndex(headers, "day");
  const viewsIdx = columnIndex(headers, "views");
  const minutesIdx = columnIndex(headers, "estimatedMinutesWatched");
  const rows: YouTubeChannelDailyTrendRow[] = [];
  for (const row of json.rows ?? []) {
    const date = String(row[dayIdx] ?? "").trim();
    if (!date) continue;
    rows.push({
      date,
      views: Number(row[viewsIdx] ?? 0) || 0,
      estimated_minutes_watched: Number(row[minutesIdx] ?? 0) || 0,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export async function fetchYouTubeChannelAnalyticsBundle(
  accessToken: string,
  channelId: string,
  dateStartYmd: string,
  dateEndYmd: string,
): Promise<YouTubeChannelAnalyticsBundle> {
  const [overview, demographics, traffic_sources, daily_trend] = await Promise.all([
    fetchChannelAnalyticsOverview(accessToken, channelId, dateStartYmd, dateEndYmd),
    fetchChannelDemographics(accessToken, channelId, dateStartYmd, dateEndYmd),
    fetchChannelTrafficSources(accessToken, channelId, dateStartYmd, dateEndYmd),
    fetchChannelDailyTrend(accessToken, channelId, dateStartYmd, dateEndYmd),
  ]);
  return { overview, demographics, traffic_sources, daily_trend };
}
