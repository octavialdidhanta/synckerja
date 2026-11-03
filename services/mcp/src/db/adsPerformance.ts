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
