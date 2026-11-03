import type { McpServiceConfig } from "../config";
import {
  presentAdsPerformance,
  resolveAdsPerformancePeriod,
  type AdsPerformanceQuery,
  type AdsPerformanceSource,
  type AdsPerformanceSourceRow,
  type AdsPerformanceSummary,
} from "../tools/ads/performanceSummary";
import {
  presentAdsBreakdown,
  resolveAdsBreakdownPeriod,
  type AdsBreakdown,
  type AdsBreakdownQuery,
  type AdsBreakdownSource,
  type AdsBreakdownSourceAccount,
} from "../tools/ads/performanceBreakdown";
import {
  presentAdsAudience,
  resolveAdsAudiencePeriod,
  type AdsAudience,
  type AdsAudienceQuery,
  type AdsAudienceSource,
  type AdsAudienceSourceAccount,
} from "../tools/ads/audienceList";
import {
  presentAdsSegments,
  resolveAdsSegmentsPeriod,
  type AdsSegments,
  type AdsSegmentsQuery,
  type AdsSegmentsSource,
  type AdsSegmentsSourceAccount,
} from "../tools/ads/performanceSegments";

type Session = { userId: string; organizationId: string };

function cleanText(value: unknown, secret: string): string | null {
  if (typeof value !== "string") return null;
  const cleaned = (secret ? value.split(secret).join("") : value).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function cleanAccount(row: AdsPerformanceSourceRow, secret: string): AdsPerformanceSourceRow {
  const error = cleanText(row.error, secret);
  return {
    ...row,
    error: row.error && !error ? "request_failed" : error,
    note: cleanText(row.note, secret),
    campaigns: (row.campaigns ?? []).map((campaign) => ({
      ...campaign,
      name: cleanText(campaign.name, secret) ?? "Campaign",
    })),
  };
}

function isSource(value: unknown): value is AdsPerformanceSource {
  if (!value || typeof value !== "object") return false;
  const row = value as AdsPerformanceSource;
  return Boolean(row.period?.start && row.period?.end && Array.isArray(row.accounts));
}

async function callPerformanceDoor(
  config: Pick<McpServiceConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "scheduledPostsInternalSecret">,
  ctx: Session,
  payload: Record<string, unknown>,
  toolName: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const secret = config.scheduledPostsInternalSecret;
  const response = await fetchImpl(`${config.supabaseUrl}/functions/v1/mcp-ads-performance`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organization_id: ctx.organizationId,
      mcp_user_id: ctx.userId,
      internal_secret: secret,
      ...payload,
    }),
  });

  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const error = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : "";
    const safeError = (secret ? error.split(secret).join("") : error).slice(0, 180);
    console.error(`${toolName}: function rejected`, {
      status: response.status,
      error: safeError,
      organizationId: ctx.organizationId,
      platform: payload.platform,
      level: payload.level,
    });
    if (safeError.startsWith("forbidden:") || safeError.startsWith("upstream_error:")) {
      throw new Error(safeError);
    }
    if (response.status === 403) throw new Error("forbidden: performance door rejected");
    if (response.status === 400) throw new Error("invalid_input");
    throw new Error("performance_unavailable");
  }
  return body;
}

export async function listAdsPerformance(
  config: Pick<McpServiceConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "scheduledPostsInternalSecret">,
  ctx: Session,
  query: AdsPerformanceQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<AdsPerformanceSummary> {
  const period = resolveAdsPerformancePeriod(query);
  const secret = config.scheduledPostsInternalSecret;
  const body = await callPerformanceDoor(config, ctx, {
    date_start: period.start,
    date_end: period.end,
    platform: query.platform,
  }, "ads.performance.summary", fetchImpl);
  if (!isSource(body)) throw new Error("performance_unavailable");
  return presentAdsPerformance({
    ...body,
    period: {
      start: body.period.start,
      end: body.period.end,
      clipped: body.period.clipped || period.clipped,
    },
    accounts: body.accounts.map((row) => cleanAccount(row, secret)),
  });
}

function cleanBreakdownAccount(row: AdsBreakdownSourceAccount, secret: string): AdsBreakdownSourceAccount {
  const error = cleanText(row.error, secret);
  return {
    ...row,
    error: row.error && !error ? "request_failed" : error,
    note: cleanText(row.note, secret),
    rows: (row.rows ?? []).map((item) => ({
      ...item,
      name: cleanText(item.name, secret) ?? "Ad",
      campaign_name: cleanText(item.campaign_name, secret) ?? "Campaign",
      adset_name: cleanText(item.adset_name, secret),
    })),
  };
}

/** Meta ad set or ad rows from the same door as the summary, with level set. */
export async function listAdsBreakdown(
  config: Pick<McpServiceConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "scheduledPostsInternalSecret">,
  ctx: Session,
  query: AdsBreakdownQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<AdsBreakdown> {
  const period = resolveAdsBreakdownPeriod(query);
  const secret = config.scheduledPostsInternalSecret;
  const body = await callPerformanceDoor(config, ctx, {
    date_start: period.start,
    date_end: period.end,
    platform: "meta",
    level: query.level,
    account_id: query.accountId ?? undefined,
    campaign_id: query.campaignId ?? undefined,
  }, "ads.performance.breakdown", fetchImpl);
  if (!isSource(body)) throw new Error("performance_unavailable");
  const source = body as unknown as AdsBreakdownSource;
  return presentAdsBreakdown({
    ...source,
    period: {
      start: source.period.start,
      end: source.period.end,
      clipped: source.period.clipped || period.clipped,
    },
    accounts: source.accounts.map((row) => cleanBreakdownAccount(row, secret)),
  }, query.level);
}

type DoorConfig = Pick<McpServiceConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "scheduledPostsInternalSecret">;

function cleanAudienceAccount(row: AdsAudienceSourceAccount, secret: string): AdsAudienceSourceAccount {
  const error = cleanText(row.error, secret);
  return {
    ...row,
    error: row.error && !error ? "request_failed" : error,
    note: cleanText(row.note, secret),
    audiences: (row.audiences ?? []).map((item) => ({
      ...item,
      adset_name: cleanText(item.adset_name, secret) ?? "Ad set",
      campaign_name: cleanText(item.campaign_name, secret) ?? "Campaign",
      error: item.error ? cleanText(item.error, secret) ?? "request_failed" : null,
    })),
  };
}

/** Targeting of Meta ad sets that delivered in the period. */
export async function listAdsAudience(
  config: DoorConfig,
  ctx: Session,
  query: AdsAudienceQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<AdsAudience> {
  const period = resolveAdsAudiencePeriod(query);
  const secret = config.scheduledPostsInternalSecret;
  const body = await callPerformanceDoor(config, ctx, {
    date_start: period.start,
    date_end: period.end,
    platform: "meta",
    mode: "audience",
    account_id: query.accountId ?? undefined,
    campaign_id: query.campaignId ?? undefined,
    adset_id: query.adsetId ?? undefined,
  }, "ads.audience.list", fetchImpl);
  if (!isSource(body)) throw new Error("performance_unavailable");
  const source = body as unknown as AdsAudienceSource;
  return presentAdsAudience({
    ...source,
    period: { start: source.period.start, end: source.period.end, clipped: source.period.clipped || period.clipped },
    accounts: source.accounts.map((row) => cleanAudienceAccount(row, secret)),
  });
}

function cleanSegmentsAccount(row: AdsSegmentsSourceAccount, secret: string): AdsSegmentsSourceAccount {
  const error = cleanText(row.error, secret);
  const segments: AdsSegmentsSourceAccount["segments"] = {};
  for (const [dimension, block] of Object.entries(row.segments ?? {})) {
    if (!block) continue;
    segments[dimension as keyof typeof segments] = {
      buckets: (block.buckets ?? []).map((bucket) => ({ ...bucket, key: cleanText(bucket.key, secret) ?? "unknown" })),
      error: block.error ? cleanText(block.error, secret) ?? "request_failed" : null,
    };
  }
  return {
    ...row,
    error: row.error && !error ? "request_failed" : error,
    note: cleanText(row.note, secret),
    segments,
  };
}

/** Meta delivery split by age, gender, region, placement, device, hour, and day. */
export async function listAdsSegments(
  config: DoorConfig,
  ctx: Session,
  query: AdsSegmentsQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<AdsSegments> {
  const period = resolveAdsSegmentsPeriod(query);
  const secret = config.scheduledPostsInternalSecret;
  const body = await callPerformanceDoor(config, ctx, {
    date_start: period.start,
    date_end: period.end,
    platform: "meta",
    mode: "segments",
    dimensions: query.dimensions,
    account_id: query.accountId ?? undefined,
    campaign_id: query.campaignId ?? undefined,
    adset_id: query.adsetId ?? undefined,
    ad_id: query.adId ?? undefined,
  }, "ads.performance.segments", fetchImpl);
  if (!isSource(body)) throw new Error("performance_unavailable");
  const source = body as unknown as AdsSegmentsSource;
  return presentAdsSegments({
    ...source,
    period: { start: source.period.start, end: source.period.end, clipped: source.period.clipped || period.clipped },
    accounts: source.accounts.map((row) => cleanSegmentsAccount(row, secret)),
  }, query.dimensions);
}
