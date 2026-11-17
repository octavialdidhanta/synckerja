import { TIKTOK_ADS_API_BASE } from "./tiktokAdsAuth.ts";

export type TikTokMetricEntity = "campaign" | "adgroup" | "ad";

const DATA_LEVEL: Record<TikTokMetricEntity, string> = {
  campaign: "AUCTION_CAMPAIGN",
  adgroup: "AUCTION_ADGROUP",
  ad: "AUCTION_AD",
};

// TikTok requires the primary dimension to match data_level (no parent IDs as dimensions).
const DIMENSIONS: Record<TikTokMetricEntity, string[]> = {
  campaign: ["campaign_id"],
  adgroup: ["adgroup_id"],
  ad: ["ad_id"],
};

const CORE_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "reach",
  "currency",
] as const;

const ENTITY_NAME_METRICS: Record<TikTokMetricEntity, string[]> = {
  campaign: ["campaign_name"],
  adgroup: ["adgroup_name", "campaign_name", "campaign_id"],
  ad: ["ad_name", "adgroup_name", "campaign_name", "adgroup_id", "campaign_id"],
};

export function metricsForEntity(entity: TikTokMetricEntity): string[] {
  return [...CORE_METRICS, ...ENTITY_NAME_METRICS[entity]];
}

type TikTokApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

type ReportListItem = {
  dimensions?: Record<string, string>;
  metrics?: Record<string, string | number>;
};

type ReportPageData = {
  list?: ReportListItem[];
  page_info?: { page?: number; page_size?: number; total_page?: number; total_number?: number };
  total_metrics?: Record<string, string | number>;
};

export async function tiktokApiGet<T>(
  accessToken: string,
  path: string,
  params: Record<string, string | number | boolean | string[]>,
): Promise<T> {
  const url = new URL(`${TIKTOK_ADS_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      url.searchParams.set(key, JSON.stringify(value));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Access-Token": accessToken },
  });
  const json = await res.json().catch(() => ({})) as TikTokApiResponse<T>;
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message ?? `TikTok API HTTP ${res.status}`);
  }
  return json.data as T;
}

export async function tiktokApiPost<T>(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${TIKTOK_ADS_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({})) as TikTokApiResponse<T>;
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message ?? `TikTok API HTTP ${res.status}`);
  }
  return json.data as T;
}

export async function exchangeTikTokAuthCode(
  appId: string,
  appSecret: string,
  authCode: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  advertiser_ids: string[];
  access_token_expires_in?: number;
  refresh_token_expires_in?: number;
}> {
  const res = await fetch(`${TIKTOK_ADS_API_BASE}/oauth2/access_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      secret: appSecret,
      auth_code: authCode,
    }),
  });
  const json = await res.json().catch(() => ({})) as TikTokApiResponse<{
    access_token?: string;
    refresh_token?: string;
    advertiser_ids?: string[];
    access_token_expires_in?: number;
    refresh_token_expires_in?: number;
  }>;
  const accessToken = json.data?.access_token?.trim() ?? "";
  const refreshToken = json.data?.refresh_token?.trim() ?? "";

  if (!res.ok || json.code !== 0 || !accessToken) {
    const apiMessage = json.message?.trim() ?? "";
    const detail = apiMessage && apiMessage !== "OK"
      ? apiMessage
      : json.code != null && json.code !== 0
        ? `token_exchange_failed (code ${json.code})`
        : !accessToken
          ? "token_exchange_missing_access_token"
          : "token_exchange_failed";
    throw new Error(detail);
  }

  // TikTok success responses use message "OK"; refresh_token may be omitted on some apps.
  return {
    access_token: accessToken,
    refresh_token: refreshToken || accessToken,
    advertiser_ids: (json.data?.advertiser_ids ?? []).map(String),
    access_token_expires_in: json.data?.access_token_expires_in,
    refresh_token_expires_in: json.data?.refresh_token_expires_in,
  };
}

export async function listTikTokAdvertisers(
  accessToken: string,
  appId: string,
  appSecret: string,
): Promise<Array<{ advertiser_id: string; advertiser_name: string }>> {
  const data = await tiktokApiGet<{ list?: Array<{ advertiser_id?: string; advertiser_name?: string }> }>(
    accessToken,
    "/oauth2/advertiser/get/",
    { app_id: appId, secret: appSecret },
  );
  return (data.list ?? []).map((row) => ({
    advertiser_id: String(row.advertiser_id ?? ""),
    advertiser_name: String(row.advertiser_name ?? row.advertiser_id ?? ""),
  })).filter((r) => r.advertiser_id);
}

function parseTikTokMetric(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || raw === "-") return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isoCurrencyCode(value: unknown): string | null {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/** total_metrics.currency is often "-" because currency is not an aggregate. Rows carry IDR/USD. */
function currencyFromReport(
  totalMetrics: Record<string, string | number>,
  rows: Record<string, unknown>[],
): string | null {
  const fromTotal = isoCurrencyCode(totalMetrics.currency);
  if (fromTotal) return fromTotal;
  for (const row of rows) {
    const code = isoCurrencyCode(row.currency);
    if (code) return code;
  }
  return null;
}

function flattenReportRow(item: ReportListItem, entity: TikTokMetricEntity): Record<string, unknown> {
  const dims = item.dimensions ?? {};
  const metrics = item.metrics ?? {};
  const row: Record<string, unknown> = { ...dims, ...metrics };
  if (entity === "campaign") {
    row.campaign_id = dims.campaign_id ?? metrics.campaign_id;
    row.campaign_name = metrics.campaign_name ?? dims.campaign_name;
  }
  if (entity === "adgroup") {
    row.adgroup_id = dims.adgroup_id ?? metrics.adgroup_id;
    row.adgroup_name = metrics.adgroup_name ?? dims.adgroup_name;
    row.campaign_id = dims.campaign_id ?? metrics.campaign_id;
    row.campaign_name = metrics.campaign_name;
  }
  if (entity === "ad") {
    row.ad_id = dims.ad_id ?? metrics.ad_id;
    row.ad_name = metrics.ad_name ?? dims.ad_name;
    row.adgroup_id = dims.adgroup_id ?? metrics.adgroup_id;
    row.adgroup_name = metrics.adgroup_name;
    row.campaign_id = dims.campaign_id ?? metrics.campaign_id;
    row.campaign_name = metrics.campaign_name;
  }
  return row;
}

export async function fetchTikTokIntegratedReport(
  accessToken: string,
  advertiserId: string,
  entity: TikTokMetricEntity,
  dateStart: string,
  dateEnd: string,
  options?: { metrics?: string[] },
): Promise<{ rows: Record<string, unknown>[]; summary: Record<string, unknown> }> {
  const allRows: Record<string, unknown>[] = [];
  let totalMetrics: Record<string, string | number> = {};
  let page = 1;
  const pageSize = 1000;

  while (true) {
    const data = await tiktokApiGet<ReportPageData>(
      accessToken,
      "/report/integrated/get/",
      {
        advertiser_id: advertiserId,
        report_type: "BASIC",
        service_type: "AUCTION",
        data_level: DATA_LEVEL[entity],
        dimensions: DIMENSIONS[entity],
        metrics: options?.metrics ?? metricsForEntity(entity),
        start_date: dateStart,
        end_date: dateEnd,
        page,
        page_size: pageSize,
        enable_total_metrics: true,
      },
    );

    for (const item of data.list ?? []) {
      allRows.push(flattenReportRow(item, entity));
    }
    if (data.total_metrics) totalMetrics = data.total_metrics;

    const totalPage = data.page_info?.total_page ?? 1;
    if (page >= totalPage) break;
    page += 1;
  }

  const onlyRow = allRows.length === 1 ? allRows[0] : null;
  const summary = {
    spend: parseTikTokMetric(totalMetrics.spend) ?? 0,
    impressions: parseTikTokMetric(totalMetrics.impressions) ?? 0,
    clicks: parseTikTokMetric(totalMetrics.clicks) ?? 0,
    reach: parseTikTokMetric(totalMetrics.reach) ?? 0,
    conversion: parseTikTokMetric(totalMetrics.conversion) ?? 0,
    complete_payment: parseTikTokMetric(totalMetrics.complete_payment) ?? 0,
    complete_payment_roas: parseTikTokMetric(totalMetrics.complete_payment_roas),
    cpc: parseTikTokMetric(totalMetrics.cpc) ?? (onlyRow ? parseTikTokMetric(onlyRow.cpc) : null),
    cpm: parseTikTokMetric(totalMetrics.cpm) ?? (onlyRow ? parseTikTokMetric(onlyRow.cpm) : null),
    currency: currencyFromReport(totalMetrics, allRows),
  };

  return { rows: allRows, summary };
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

function coverFromTikTokPost(post: Record<string, unknown>): string {
  const video = post.video_info;
  if (video && typeof video === "object" && !Array.isArray(video)) {
    const poster = firstString((video as Record<string, unknown>).poster_url);
    if (poster) return poster;
  }
  const carousel = post.carousel_info;
  if (carousel && typeof carousel === "object" && !Array.isArray(carousel)) {
    const images = (carousel as Record<string, unknown>).image_info;
    if (Array.isArray(images)) {
      for (const image of images) {
        if (image && typeof image === "object") {
          const url = firstString((image as Record<string, unknown>).image_url);
          if (url) return url;
        }
      }
    }
  }
  return "";
}

function firstString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstString(item);
      if (text) return text;
    }
  }
  return "";
}

/** Cover image for each ad row. Missing creatives leave the row without a thumbnail. */
export async function attachTikTokAdThumbnails(
  accessToken: string,
  advertiserId: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const adIds = [...new Set(rows.map((row) => String(row.ad_id ?? "").trim()).filter(Boolean))];
  if (adIds.length === 0) return;

  const videoByAd = new Map<string, string>();
  const imageByAd = new Map<string, string>();
  const sparkByAd = new Map<string, { itemId: string; identityType: string; identityId: string; bcId: string }>();
  for (const ids of chunkIds(adIds, 100)) {
    try {
      const data = await tiktokApiGet<{ list?: Array<Record<string, unknown>> }>(
        accessToken,
        "/ad/get/",
        {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ ad_ids: ids }),
          fields: [
            "ad_id",
            "video_id",
            "image_ids",
            "tiktok_item_id",
            "identity_id",
            "identity_type",
            "identity_authorized_bc_id",
          ],
          page: 1,
          page_size: 100,
        },
      );
      for (const ad of data.list ?? []) {
        const adId = String(ad.ad_id ?? "").trim();
        if (!adId) continue;
        const videoId = String(ad.video_id ?? "").trim();
        const imageId = firstString(ad.image_ids);
        const itemId = String(ad.tiktok_item_id ?? "").trim();
        const identityType = String(ad.identity_type ?? "").trim();
        const identityId = String(ad.identity_id ?? "").trim();
        const bcId = String(ad.identity_authorized_bc_id ?? "").trim();
        if (videoId) videoByAd.set(adId, videoId);
        if (imageId) imageByAd.set(adId, imageId);
        if (itemId && identityId && identityType && identityType !== "CUSTOMIZED_USER") {
          sparkByAd.set(adId, { itemId, identityType, identityId, bcId });
        }
      }
    } catch (error) {
      console.warn("tiktok ad/get thumbnails:", error instanceof Error ? error.message : error);
    }
  }

  const coverByVideo = new Map<string, string>();
  for (const ids of chunkIds([...new Set(videoByAd.values())], 60)) {
    try {
      const data = await tiktokApiGet<{ list?: Array<Record<string, unknown>> }>(
        accessToken,
        "/file/video/ad/info/",
        { advertiser_id: advertiserId, video_ids: ids },
      );
      for (const video of data.list ?? []) {
        const videoId = String(video.video_id ?? "").trim();
        const cover = firstString(video.video_cover_url) || firstString(video.poster_url);
        if (videoId && cover) coverByVideo.set(videoId, cover);
      }
    } catch (error) {
      console.warn("tiktok video covers:", error instanceof Error ? error.message : error);
    }
  }

  const coverByItem = new Map<string, string>();
  const sparkGroups = new Map<string, { identityType: string; identityId: string; bcId: string; itemIds: string[] }>();
  for (const spark of sparkByAd.values()) {
    const key = `${spark.identityType}|${spark.identityId}|${spark.bcId}`;
    const group = sparkGroups.get(key) ?? {
      identityType: spark.identityType,
      identityId: spark.identityId,
      bcId: spark.bcId,
      itemIds: [],
    };
    if (!group.itemIds.includes(spark.itemId)) group.itemIds.push(spark.itemId);
    sparkGroups.set(key, group);
  }
  for (const group of sparkGroups.values()) {
    for (const itemIds of chunkIds(group.itemIds, 20)) {
      try {
        const params: Record<string, string | string[]> = {
          advertiser_id: advertiserId,
          identity_type: group.identityType,
          identity_id: group.identityId,
          item_ids: itemIds,
        };
        if (group.bcId) params.identity_authorized_bc_id = group.bcId;
        const data = await tiktokApiGet<{
          video_detail?: Record<string, unknown>;
          video_details?: Array<Record<string, unknown>> | Record<string, unknown>;
        }>(accessToken, "/identity/video/info/", params);
        const posts: Record<string, unknown>[] = [];
        if (data.video_detail) posts.push(data.video_detail);
        const details = data.video_details;
        if (Array.isArray(details)) posts.push(...details);
        else if (details && typeof details === "object") {
          const record = details as Record<string, unknown>;
          if (record.item_id || record.video_info || record.carousel_info) posts.push(record);
          else {
            for (const [key, value] of Object.entries(record)) {
              if (!value || typeof value !== "object" || Array.isArray(value)) continue;
              const post = { ...(value as Record<string, unknown>) };
              if (!post.item_id) post.item_id = key;
              posts.push(post);
            }
          }
        }
        for (const post of posts) {
          const itemId = String(post.item_id ?? "").trim();
          const cover = coverFromTikTokPost(post);
          if (itemId && cover) coverByItem.set(itemId, cover);
        }
      } catch (error) {
        console.warn("tiktok spark covers:", error instanceof Error ? error.message : error);
      }
    }
  }

  const urlByImage = new Map<string, string>();
  for (const ids of chunkIds([...new Set(imageByAd.values())], 100)) {
    try {
      const data = await tiktokApiGet<{ list?: Array<Record<string, unknown>> }>(
        accessToken,
        "/file/image/ad/info/",
        { advertiser_id: advertiserId, image_ids: ids },
      );
      for (const image of data.list ?? []) {
        const imageId = String(image.image_id ?? "").trim();
        const url = firstString(image.image_url) || firstString(image.url);
        if (imageId && url) urlByImage.set(imageId, url);
      }
    } catch (error) {
      console.warn("tiktok image covers:", error instanceof Error ? error.message : error);
    }
  }

  for (const row of rows) {
    const adId = String(row.ad_id ?? "").trim();
    const videoId = videoByAd.get(adId) ?? "";
    const imageId = imageByAd.get(adId) ?? "";
    const itemId = sparkByAd.get(adId)?.itemId ?? "";
    const url = (videoId && coverByVideo.get(videoId)) ||
      (itemId && coverByItem.get(itemId)) ||
      (imageId && urlByImage.get(imageId)) ||
      "";
    if (url) row.thumbnail_url = url;
  }
}
