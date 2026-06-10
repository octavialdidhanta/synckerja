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
        metrics: metricsForEntity(entity),
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

  const summary = {
    spend: parseFloat(String(totalMetrics.spend ?? 0)) || 0,
    impressions: parseFloat(String(totalMetrics.impressions ?? 0)) || 0,
    clicks: parseFloat(String(totalMetrics.clicks ?? 0)) || 0,
    reach: parseFloat(String(totalMetrics.reach ?? 0)) || 0,
    currency: String(totalMetrics.currency ?? "USD"),
  };

  return { rows: allRows, summary };
}
