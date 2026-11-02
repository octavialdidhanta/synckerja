import type { McpServiceConfig } from "../config";
import {
  presentAdsPerformance,
  resolveAdsPerformancePeriod,
  type AdsPerformanceQuery,
  type AdsPerformanceSource,
  type AdsPerformanceSourceRow,
  type AdsPerformanceSummary,
} from "../tools/ads/performanceSummary";

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

export async function listAdsPerformance(
  config: Pick<McpServiceConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "scheduledPostsInternalSecret">,
  ctx: Session,
  query: AdsPerformanceQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<AdsPerformanceSummary> {
  const period = resolveAdsPerformancePeriod(query);
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
      date_start: period.start,
      date_end: period.end,
      platform: query.platform,
    }),
  });

  if (response.status === 403) throw new Error("forbidden");
  if (response.status === 400) throw new Error("invalid_input");
  if (!response.ok) throw new Error("performance_unavailable");

  const body = (await response.json()) as unknown;
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
