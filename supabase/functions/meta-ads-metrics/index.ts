/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  metaAdsCorsHeaders,
  metaAdsJson,
  metaGraphVersion,
  readPlatformMetaAdsOAuth,
} from "../_shared/metaAdsAuth.ts";
import {
  enrichMetaCampaignRowsWithServiceEconomics,
  handleUpsertMetaCampaignServiceMapping,
} from "../_shared/metaAdsCampaignServices.ts";
import { metaActId, resolveOrgMetaAdsForMetrics } from "../_shared/metaAdsOrgResolver.ts";
import {
  buildChannelPeriodSummary,
  buildMonthWindowsInRange,
  countMetaAttributedLeadsByMonth,
  emptySpendBucketsForWindows,
  monthPeriodKey,
  monthPeriodKeyFromWindow,
  sumAttributedLeadsByMonth,
  enrichSpendBucketsWithAttribution,
  type MetaCampaignRef,
  type MonthWindow,
} from "../_shared/monthlyReportAttribution.ts";
import {
  loadMetaCampaignServiceMappings,
  parseMonthlyServiceIdFilter,
  resolveMetaMonthlyServiceScope,
} from "../_shared/monthlyReportServiceFilter.ts";
import { metaAdsReportCurrency } from "../_shared/metaAdsReportCurrency.ts";
import { aggregateMetaRowsByService } from "../_shared/metaAdsReportByService.ts";
import { maybeEnrichMetaCampaignRowsWithSynckerja } from "../_shared/metaAdsCampaignSynckerja.ts";

const CACHE_TTL_MINUTES = 10;

/** Bust cache when Synckerja traffic/leads enrichment ships. */
const METRICS_CACHE_KEY = "account-insights-v7";

/** Meta often returns empty rows for very long single-shot insights queries. */
const MAX_SINGLE_INSIGHTS_RANGE_DAYS = 92;

const MONTHLY_SPEND_CACHE_KEY = "monthly-spend-v7";

function monthlySpendCacheKey(serviceIdFilter: string | null): string {
  return serviceIdFilter
    ? `${MONTHLY_SPEND_CACHE_KEY}:svc:${serviceIdFilter}`
    : MONTHLY_SPEND_CACHE_KEY;
}

const ACCOUNT_SUMMARY_FIELDS = "spend,impressions,clicks,reach,account_currency";

/** Match Ads Manager attribution (unified ad-set settings). */
const INSIGHTS_ATTRIBUTION_PARAMS = "use_unified_attribution_setting=true";

type MetricEntity = "campaign" | "adset" | "ad";

function entityEffectiveStatusField(entity: MetricEntity): string {
  if (entity === "campaign") return "campaign.effective_status";
  if (entity === "adset") return "adset.effective_status";
  return "ad.effective_status";
}

/** Exclude deleted/archived entities — closer to default Ads Manager tables. */
function entityInsightsFiltering(entity: MetricEntity): string {
  return encodeURIComponent(
    JSON.stringify([
      {
        field: entityEffectiveStatusField(entity),
        operator: "NOT_IN",
        value: ["DELETED", "ARCHIVED"],
      },
    ]),
  );
}

const ENTITY_LEVEL: Record<MetricEntity, string> = {
  campaign: "campaign",
  adset: "adset",
  ad: "ad",
};

const INSIGHT_FIELDS = [
  "campaign_name",
  "campaign_id",
  "adset_name",
  "adset_id",
  "ad_name",
  "ad_id",
  "spend",
  "impressions",
  "clicks",
  "cpc",
  "cpm",
  "ctr",
  "reach",
  "actions",
  "account_currency",
].join(",");

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

/** Meta Graph (#3018): start cannot be more than 37 months before today. */
const META_ADS_MAX_LOOKBACK_MONTHS = 37;

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function metaAdsEarliestAllowedStart(now: Date): Date {
  const today = startOfDayLocal(now);
  return new Date(
    today.getFullYear(),
    today.getMonth() - META_ADS_MAX_LOOKBACK_MONTHS,
    today.getDate(),
  );
}

function clampMetaAdsDateRange(
  startYmd: string,
  endYmd: string,
  now: Date = new Date(),
): { start: string; end: string } {
  const minStart = metaAdsEarliestAllowedStart(now);
  let start = parseYmd(startYmd) ?? minStart;
  let end = parseYmd(endYmd) ?? startOfDayLocal(now);
  start = startOfDayLocal(start);
  end = startOfDayLocal(end);
  if (start.getTime() < minStart.getTime()) start = minStart;
  if (start.getTime() > end.getTime()) start = end;
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

type AccountSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  currency: string;
};

function daysBetweenYmd(startYmd: string, endYmd: string): number {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end) return 0;
  return Math.max(
    0,
    Math.round((startOfDayLocal(end).getTime() - startOfDayLocal(start).getTime()) / 86400000),
  );
}

/** Split [start, end] into contiguous windows of at most `maxDays` days. */
function splitDateRangeIntoChunks(
  startYmd: string,
  endYmd: string,
  maxDays: number,
): { start: string; end: string }[] {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end || start.getTime() > end.getTime()) {
    return [{ start: startYmd, end: endYmd }];
  }

  const chunks: { start: string; end: string }[] = [];
  let cursor = startOfDayLocal(start);
  const endDay = startOfDayLocal(end);

  while (cursor.getTime() <= endDay.getTime()) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);
    const effectiveEnd = chunkEnd.getTime() > endDay.getTime() ? endDay : chunkEnd;
    chunks.push({
      start: formatDateYmd(cursor),
      end: formatDateYmd(effectiveEnd),
    });
    const next = new Date(effectiveEnd);
    next.setDate(next.getDate() + 1);
    cursor = next;
  }

  return chunks.length > 0 ? chunks : [{ start: startYmd, end: endYmd }];
}

function parseNumField(value: unknown): number {
  const n = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function entityRowKey(row: Record<string, unknown>, entity: MetricEntity): string {
  if (entity === "campaign") return String(row.campaign_id ?? "").trim();
  if (entity === "adset") return String(row.adset_id ?? "").trim();
  return String(row.ad_id ?? "").trim();
}

function mergeEntityInsightRows(
  rows: Record<string, unknown>[],
  entity: MetricEntity,
): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const key = entityRowKey(row, entity);
    if (!key) continue;

    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...row });
      continue;
    }

    const spend = parseNumField(prev.spend) + parseNumField(row.spend);
    const impressions = Math.round(parseNumField(prev.impressions) + parseNumField(row.impressions));
    const clicks = Math.round(parseNumField(prev.clicks) + parseNumField(row.clicks));
    const reach = Math.round(parseNumField(prev.reach) + parseNumField(row.reach));

    prev.spend = String(spend);
    prev.impressions = String(impressions);
    prev.clicks = String(clicks);
    prev.reach = String(reach);
    prev.ctr = impressions > 0 ? String((clicks / impressions) * 100) : "0";
    prev.cpc = clicks > 0 ? String(spend / clicks) : "0";
    prev.cpm = impressions > 0 ? String((spend / impressions) * 1000) : "0";
    if (row.account_currency) prev.account_currency = row.account_currency;
    if (row.campaign_name) prev.campaign_name = row.campaign_name;
    if (row.adset_name) prev.adset_name = row.adset_name;
    if (row.ad_name) prev.ad_name = row.ad_name;
  }

  return [...byKey.values()];
}

async function fetchGraphInsightsPages(
  graphVersion: string,
  path: string,
  accessToken: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let currentPath = path;

  for (let page = 0; page < 50; page++) {
    const url =
      `https://graph.facebook.com/${graphVersion}/${currentPath}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const rows = (json as { data?: unknown[] })?.data ?? [];
    for (const row of rows) {
      out.push(row as Record<string, unknown>);
    }

    const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
    const after = paging?.cursors?.after;
    if (!after) break;

    const base = path.includes("&after=") ? path.replace(/&after=[^&]+/, "") : path;
    currentPath = `${base}&after=${encodeURIComponent(after)}`;
  }

  return out;
}

async function fetchEntityInsightsForChunk(
  graphVersion: string,
  act: string,
  entity: MetricEntity,
  dateStart: string,
  dateEnd: string,
  accessToken: string,
): Promise<Record<string, unknown>[]> {
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateStart, until: dateEnd }));
  const level = ENTITY_LEVEL[entity];
  const filtering = entityInsightsFiltering(entity);
  const path =
    `${act}/insights?fields=${INSIGHT_FIELDS}&level=${level}&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_range=${timeRange}&limit=100`;
  return await fetchGraphInsightsPages(graphVersion, path, accessToken);
}

async function fetchEntityInsightsForRange(
  graphVersion: string,
  act: string,
  entity: MetricEntity,
  dateStart: string,
  dateEnd: string,
  accessToken: string,
): Promise<Record<string, unknown>[]> {
  const spanDays = daysBetweenYmd(dateStart, dateEnd);
  if (spanDays <= MAX_SINGLE_INSIGHTS_RANGE_DAYS) {
    return await fetchEntityInsightsForChunk(
      graphVersion,
      act,
      entity,
      dateStart,
      dateEnd,
      accessToken,
    );
  }

  const chunks = splitDateRangeIntoChunks(
    dateStart,
    dateEnd,
    MAX_SINGLE_INSIGHTS_RANGE_DAYS,
  );
  const parts = await Promise.all(
    chunks.map((chunk) =>
      fetchEntityInsightsForChunk(
        graphVersion,
        act,
        entity,
        chunk.start,
        chunk.end,
        accessToken,
      ),
    ),
  );
  return mergeEntityInsightRows(parts.flat(), entity);
}

async function fetchAdsManagerAlignedSummaryForRange(
  graphVersion: string,
  act: string,
  dateStart: string,
  dateEnd: string,
  accessToken: string,
): Promise<AccountSummary> {
  const spanDays = daysBetweenYmd(dateStart, dateEnd);
  if (spanDays <= MAX_SINGLE_INSIGHTS_RANGE_DAYS) {
    const timeRange = encodeURIComponent(JSON.stringify({ since: dateStart, until: dateEnd }));
    return await fetchAdsManagerAlignedSummary(graphVersion, act, timeRange, accessToken);
  }

  const chunks = splitDateRangeIntoChunks(
    dateStart,
    dateEnd,
    MAX_SINGLE_INSIGHTS_RANGE_DAYS,
  );
  const parts = await Promise.all(
    chunks.map(async (chunk) => {
      const timeRange = encodeURIComponent(
        JSON.stringify({ since: chunk.start, until: chunk.end }),
      );
      return await fetchAdsManagerAlignedSummary(
        graphVersion,
        act,
        timeRange,
        accessToken,
      );
    }),
  );

  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let reach = 0;
  let currency = metaAdsReportCurrency();
  for (const part of parts) {
    spend += part.spend;
    impressions += part.impressions;
    clicks += part.clicks;
    reach += part.reach;
    if (part.currency) currency = metaAdsReportCurrency(part.currency);
  }

  return { spend, impressions, clicks, reach, currency };
}

/** Sum ad-level insights — matches Meta Ads Manager Ads tab footer totals. */
async function fetchAdsManagerAlignedSummary(
  graphVersion: string,
  act: string,
  timeRangeEncoded: string,
  accessToken: string,
): Promise<AccountSummary> {
  const fields = ACCOUNT_SUMMARY_FIELDS;
  const filtering = entityInsightsFiltering("ad");
  let path =
    `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_range=${timeRangeEncoded}&limit=500`;

  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let reach = 0;
  let currency = metaAdsReportCurrency();

  for (let page = 0; page < 50; page++) {
    const url =
      `https://graph.facebook.com/${graphVersion}/${path}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const rows = (json as { data?: unknown[] })?.data ?? [];
    for (const row of rows) {
      const r = row as {
        spend?: string;
        impressions?: string;
        clicks?: string;
        reach?: string;
        account_currency?: string;
      };
      spend += parseFloat(r.spend ?? "0") || 0;
      impressions += parseInt(r.impressions ?? "0", 10) || 0;
      clicks += parseInt(r.clicks ?? "0", 10) || 0;
      reach += parseInt(r.reach ?? "0", 10) || 0;
      if (r.account_currency) currency = metaAdsReportCurrency(r.account_currency);
    }

    const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
    const after = paging?.cursors?.after;
    if (!after) break;
    path =
      `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_range=${timeRangeEncoded}&limit=500&after=${encodeURIComponent(after)}`;
  }

  return { spend, impressions, clicks, reach, currency };
}

type MonthlySpendBucket = { year: number; month: number; spend: number };

function spendBucketsFromWindows(monthWindows: MonthWindow[]): MonthlySpendBucket[] {
  return emptySpendBucketsForWindows(monthWindows);
}

function parseMonthlyPeriodKey(dateStart: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(String(dateStart).trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return monthPeriodKey(year, month);
}

async function fetchMetaCampaignRefs(
  graphVersion: string,
  act: string,
  accessToken: string,
): Promise<MetaCampaignRef[]> {
  const refs: MetaCampaignRef[] = [];
  const seen = new Set<string>();
  let path = `${act}/campaigns?fields=id,name&limit=500`;

  for (let page = 0; page < 50; page++) {
    const url =
      `https://graph.facebook.com/${graphVersion}/${path}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      console.warn("fetchMetaCampaignRefs:", msg);
      break;
    }

    const rows = (json as { data?: unknown[] })?.data ?? [];
    for (const row of rows) {
      const r = row as { id?: string; name?: string };
      const id = String(r.id ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      refs.push({ id, name: String(r.name ?? "").trim() });
    }

    const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
    const after = paging?.cursors?.after;
    if (!after) break;
    path =
      `${act}/campaigns?fields=id,name&limit=500&after=${encodeURIComponent(after)}`;
  }

  return refs;
}

/** Monthly spend from ad-level insights — matches table summary & Ads Manager. */
async function fetchMonthlyAdsManagerAlignedSpend(
  graphVersion: string,
  act: string,
  timeRangeEncoded: string,
  accessToken: string,
  monthWindows: MonthWindow[],
): Promise<{ months: MonthlySpendBucket[]; currency: string }> {
  const fields = "spend,account_currency,date_start,date_stop";
  const filtering = entityInsightsFiltering("ad");
  let path =
    `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRangeEncoded}&limit=500`;
  const bucketByKey = new Map<string, MonthlySpendBucket>();
  for (const w of monthWindows) {
    bucketByKey.set(monthPeriodKeyFromWindow(w), {
      year: w.year,
      month: w.month,
      spend: 0,
    });
  }
  let currency = metaAdsReportCurrency();

  for (let page = 0; page < 50; page++) {
    const url =
      `https://graph.facebook.com/${graphVersion}/${path}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const rows = (json as { data?: unknown[] })?.data ?? [];
    for (const row of rows) {
      const r = row as {
        spend?: string;
        account_currency?: string;
        date_start?: string;
      };
      if (r.account_currency) currency = metaAdsReportCurrency(r.account_currency);
      const periodKey = parseMonthlyPeriodKey(String(r.date_start ?? ""));
      if (!periodKey) continue;
      const bucket = bucketByKey.get(periodKey);
      if (!bucket) continue;
      const spend = parseFloat(r.spend ?? "0") || 0;
      bucket.spend += spend;
    }

    const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
    const after = paging?.cursors?.after;
    if (!after) break;
    path =
      `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRangeEncoded}&limit=500&after=${encodeURIComponent(after)}`;
  }

  const months = monthWindows.map((w) => bucketByKey.get(monthPeriodKeyFromWindow(w))!);
  return { months, currency };
}

/** Monthly spend for a subset of campaigns (service / unmapped filter). */
async function fetchMonthlyCampaignFilteredSpend(
  graphVersion: string,
  act: string,
  timeRangeEncoded: string,
  accessToken: string,
  monthWindows: MonthWindow[],
  allowedCampaignIds: Set<string>,
): Promise<{ months: MonthlySpendBucket[]; currency: string }> {
  if (allowedCampaignIds.size === 0) {
    return { months: spendBucketsFromWindows(monthWindows), currency: metaAdsReportCurrency() };
  }

  const fields = "spend,account_currency,date_start,campaign_id";
  const filtering = entityInsightsFiltering("campaign");
  let path =
    `${act}/insights?fields=${fields}&level=campaign&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRangeEncoded}&limit=500`;
  const bucketByKey = new Map<string, MonthlySpendBucket>();
  for (const w of monthWindows) {
    bucketByKey.set(monthPeriodKeyFromWindow(w), {
      year: w.year,
      month: w.month,
      spend: 0,
    });
  }
  let currency = metaAdsReportCurrency();

  for (let page = 0; page < 50; page++) {
    const url =
      `https://graph.facebook.com/${graphVersion}/${path}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const rows = (json as { data?: unknown[] })?.data ?? [];
    for (const row of rows) {
      const r = row as {
        spend?: string;
        account_currency?: string;
        date_start?: string;
        campaign_id?: string;
      };
      const cid = String(r.campaign_id ?? "").trim();
      if (!cid || !allowedCampaignIds.has(cid)) continue;
      if (r.account_currency) currency = metaAdsReportCurrency(r.account_currency);
      const periodKey = parseMonthlyPeriodKey(String(r.date_start ?? ""));
      if (!periodKey) continue;
      const bucket = bucketByKey.get(periodKey);
      if (!bucket) continue;
      const spend = parseFloat(r.spend ?? "0") || 0;
      bucket.spend += spend;
    }

    const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
    const after = paging?.cursors?.after;
    if (!after) break;
    path =
      `${act}/insights?fields=${fields}&level=campaign&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRangeEncoded}&limit=500&after=${encodeURIComponent(after)}`;
  }

  const months = monthWindows.map((w) => bucketByKey.get(monthPeriodKeyFromWindow(w))!);
  return { months, currency };
}

async function handleMonthlySpendBreakdown(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
  now: Date,
): Promise<Response> {
  const yearRaw = Number(body.year);
  const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
    ? Math.floor(yearRaw)
    : now.getFullYear();

  const adAccountIdParam = body.ad_account_id != null ? String(body.ad_account_id).trim() : null;
  const resolved = await resolveOrgMetaAdsForMetrics(admin, organizationId, adAccountIdParam);
  if (!resolved) {
    return metaAdsJson({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const { accessToken, account } = resolved;
  const act = metaActId(account.ad_account_id);
  const startOverride = body.date_start != null ? String(body.date_start).trim() : "";
  const start = startOverride || `${year}-01-01`;
  const defaultEnd = year === now.getFullYear() ? formatDateYmd(now) : `${year}-12-31`;
  const endOverride = body.date_end != null ? String(body.date_end).trim() : "";
  const end = endOverride || defaultEnd;
  const { start: dateStart, end: dateEnd } = clampMetaAdsDateRange(start, end, now);
  const serviceIdFilter = parseMonthlyServiceIdFilter(body);
  const cacheKey = monthlySpendCacheKey(serviceIdFilter);

  const { data: cached } = await admin
    .from("meta_ads_metrics_cache")
    .select("response_json, fetched_at, expires_at")
    .eq("organization_id", organizationId)
    .eq("ad_account_id", account.ad_account_id)
    .eq("entity", "campaign")
    .eq("date_start", dateStart)
    .eq("date_end", dateEnd)
    .eq("metrics_key", cacheKey)
    .eq("page_token", "")
    .maybeSingle();

  if (cached?.expires_at && new Date(String(cached.expires_at)).getTime() > now.getTime()) {
    const cachedPayload = cached.response_json as { currency?: string };
    return metaAdsJson({
      ...(cached.response_json as object),
      currency: metaAdsReportCurrency(cachedPayload.currency),
      cached: true,
      fetched_at: cached.fetched_at,
    }, 200);
  }

  const v = metaGraphVersion();
  const timeRange = encodeURIComponent(JSON.stringify({ since: dateStart, until: dateEnd }));

  try {
    const campaigns = await fetchMetaCampaignRefs(v, act, accessToken);
    const mappingsByCampaign = await loadMetaCampaignServiceMappings(
      admin,
      organizationId,
      account.ad_account_id,
    );
    const scope = resolveMetaMonthlyServiceScope(
      campaigns,
      mappingsByCampaign,
      serviceIdFilter,
    );

    const monthWindows = buildMonthWindowsInRange(dateStart, dateEnd);

    const { months: spendBuckets, currency } = serviceIdFilter != null
      ? await fetchMonthlyCampaignFilteredSpend(
        v,
        act,
        timeRange,
        accessToken,
        monthWindows,
        scope.googleCampaignIds,
      )
      : await fetchMonthlyAdsManagerAlignedSpend(
        v,
        act,
        timeRange,
        accessToken,
        monthWindows,
      );
    const leadsByMonth = await countMetaAttributedLeadsByMonth(
      admin,
      organizationId,
      dateStart,
      dateEnd,
      monthWindows,
      scope.metaCampaignRefs,
    );
    const months = enrichSpendBucketsWithAttribution(spendBuckets, leadsByMonth);
    const periodConvertedLeads = sumAttributedLeadsByMonth(leadsByMonth);
    const period_summary = buildChannelPeriodSummary(spendBuckets, periodConvertedLeads);

    const responsePayload = {
      year,
      currency: metaAdsReportCurrency(currency),
      months,
      period_summary,
      ad_account_id: account.ad_account_id,
      date_start: dateStart,
      date_end: dateEnd,
      service_id: serviceIdFilter,
      cached: false,
    };

    const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
    await admin.from("meta_ads_metrics_cache").upsert(
      {
        organization_id: organizationId,
        ad_account_id: account.ad_account_id,
        entity: "campaign",
        date_start: dateStart,
        date_end: dateEnd,
        metrics_key: cacheKey,
        page_token: "",
        response_json: responsePayload,
        fetched_at: now.toISOString(),
        expires_at: expiresAt,
      },
      {
        onConflict:
          "organization_id,ad_account_id,entity,date_start,date_end,metrics_key,page_token",
      },
    );

    return metaAdsJson(responsePayload, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load monthly spend";
    return metaAdsJson({ error: msg }, 400);
  }
}

async function handleFetchMetaReportByService(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
  now: Date,
): Promise<Response> {
  const adAccountIdParam = body.ad_account_id != null ? String(body.ad_account_id).trim() : null;
  const resolved = await resolveOrgMetaAdsForMetrics(admin, organizationId, adAccountIdParam);
  if (!resolved) {
    return metaAdsJson({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const { accessToken, account } = resolved;
  const act = metaActId(account.ad_account_id);
  const dr = defaultDateRange();
  const rawStart = String(body.date_start ?? dr.start).trim();
  const rawEnd = String(body.date_end ?? dr.end).trim();
  const { start: dateStart, end: dateEnd } = clampMetaAdsDateRange(rawStart, rawEnd, now);
  const unmappedLabel = String(body.unmapped_label ?? "Unmapped").trim() || "Unmapped";

  const v = metaGraphVersion();

  try {
    let rows = await fetchEntityInsightsForRange(
      v,
      act,
      "campaign",
      dateStart,
      dateEnd,
      accessToken,
    );
    rows = mergeEntityInsightRows(rows, "campaign");

    if (rows.length > 0) {
      await enrichMetaCampaignRowsWithServiceEconomics(
        admin,
        organizationId,
        account.ad_account_id,
        dateStart,
        dateEnd,
        rows,
      );
    }

    const aggregates = aggregateMetaRowsByService(rows, unmappedLabel);
    let currencyCode = metaAdsReportCurrency();
    for (const row of rows) {
      if (row.account_currency) {
        currencyCode = metaAdsReportCurrency(String(row.account_currency));
        break;
      }
    }

    return metaAdsJson({
      rows: aggregates,
      currency_code: currencyCode,
      date_start: dateStart,
      date_end: dateEnd,
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load report by service";
    return metaAdsJson({ error: msg }, 400);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: metaAdsCorsHeaders });
  }
  if (req.method !== "POST") {
    return metaAdsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return metaAdsJson({ error: "Server misconfigured" }, 500);
  }

  if (!readPlatformMetaAdsOAuth()) {
    return metaAdsJson({ error: "Meta Ads is not configured on the server" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return metaAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) {
    return metaAdsJson({ error: "Missing organization_id" }, 400);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.userId)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null ? String(profile.active_organization_id) : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return metaAdsJson({ error: "Forbidden" }, 403);
  }

  const now = new Date();

  const action = String(body.action ?? "").trim();
  if (action === "fetchReportByService") {
    return await handleFetchMetaReportByService(admin, body, organizationId, now);
  }

  if (body.monthly_breakdown === true) {
    return await handleMonthlySpendBreakdown(admin, body, organizationId, now);
  }

  if (action === "upsertCampaignServiceMapping") {
    const result = await handleUpsertMetaCampaignServiceMapping(
      admin,
      body,
      organizationId,
      userRes.userId,
    );
    if ("error" in result) {
      return metaAdsJson({ error: result.error }, result.status);
    }
    return metaAdsJson({ ok: true, mapping: result.mapping }, 200);
  }

  const entity = (String(body.entity ?? "campaign").trim() as MetricEntity) || "campaign";
  if (!ENTITY_LEVEL[entity]) {
    return metaAdsJson({ error: "Invalid entity" }, 400);
  }

  const dr = defaultDateRange();
  const rawStart = String(body.date_start ?? dr.start).trim();
  const rawEnd = String(body.date_end ?? dr.end).trim();
  const { start: dateStart, end: dateEnd } = clampMetaAdsDateRange(rawStart, rawEnd, now);
  const adAccountIdParam = body.ad_account_id != null ? String(body.ad_account_id).trim() : null;
  const pageToken = String(body.page_token ?? "").trim();
  const forceRefresh = body.force_refresh === true;

  const resolved = await resolveOrgMetaAdsForMetrics(admin, organizationId, adAccountIdParam);
  if (!resolved) {
    return metaAdsJson({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const { accessToken, account } = resolved;
  const act = metaActId(account.ad_account_id);
  const metricsKey = METRICS_CACHE_KEY;

  const { data: cached } = await admin
    .from("meta_ads_metrics_cache")
    .select("response_json, fetched_at, expires_at")
    .eq("organization_id", organizationId)
    .eq("ad_account_id", account.ad_account_id)
    .eq("entity", entity)
    .eq("date_start", dateStart)
    .eq("date_end", dateEnd)
    .eq("metrics_key", metricsKey)
    .eq("page_token", pageToken)
    .maybeSingle();

  const spanDays = daysBetweenYmd(dateStart, dateEnd);
  const useChunkedInsights = spanDays > MAX_SINGLE_INSIGHTS_RANGE_DAYS;

  if (
    !forceRefresh &&
    cached?.expires_at &&
    new Date(String(cached.expires_at)).getTime() > now.getTime()
  ) {
    const cachedPayload = cached.response_json as {
      rows?: Record<string, unknown>[];
      summary?: AccountSummary;
    };
    const cachedRows = Array.isArray(cachedPayload.rows) ? cachedPayload.rows : [];
    const cachedSpend = cachedPayload.summary?.spend ?? 0;
    const staleEmptyLongRange =
      useChunkedInsights && cachedRows.length === 0 && cachedSpend === 0;

    if (!staleEmptyLongRange) {
      if (entity === "campaign" && cachedRows.length > 0) {
        await enrichMetaCampaignRowsWithServiceEconomics(
          admin,
          organizationId,
          account.ad_account_id,
          dateStart,
          dateEnd,
          cachedRows,
        );
        await maybeEnrichMetaCampaignRowsWithSynckerja(
          admin,
          organizationId,
          dateStart,
          dateEnd,
          cachedRows,
        );
      }
      return metaAdsJson({
        ...cachedPayload,
        cached: true,
        fetched_at: cached.fetched_at,
      }, 200);
    }
  }

  const v = metaGraphVersion();

  let summary: AccountSummary;
  try {
    summary = await fetchAdsManagerAlignedSummaryForRange(
      v,
      act,
      dateStart,
      dateEnd,
      accessToken,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load account summary";
    return metaAdsJson({ error: msg }, 400);
  }

  let rows: Record<string, unknown>[] = [];
  let nextPageToken = "";
  try {
    if (useChunkedInsights) {
      rows = await fetchEntityInsightsForRange(
        v,
        act,
        entity,
        dateStart,
        dateEnd,
        accessToken,
      );
    } else {
      const timeRange = encodeURIComponent(JSON.stringify({ since: dateStart, until: dateEnd }));
      const level = ENTITY_LEVEL[entity];
      const filtering = entityInsightsFiltering(entity);
      let path =
        `${act}/insights?fields=${INSIGHT_FIELDS}&level=${level}&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_range=${timeRange}&limit=100`;
      if (pageToken) path += `&after=${encodeURIComponent(pageToken)}`;

      const url = `https://graph.facebook.com/${v}/${path}&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }
      rows = ((json as { data?: unknown[] })?.data ?? []) as Record<string, unknown>[];
      const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
      nextPageToken = paging?.cursors?.after ?? "";
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load insights";
    return metaAdsJson({ error: msg }, 400);
  }

  if (entity === "campaign" && rows.length > 0) {
    await enrichMetaCampaignRowsWithServiceEconomics(
      admin,
      organizationId,
      account.ad_account_id,
      dateStart,
      dateEnd,
      rows,
    );
    await maybeEnrichMetaCampaignRowsWithSynckerja(
      admin,
      organizationId,
      dateStart,
      dateEnd,
      rows,
    );
  }

  const responsePayload = {
    rows,
    summary: {
      spend: summary.spend,
      impressions: summary.impressions,
      clicks: summary.clicks,
      reach: summary.reach,
      currency: metaAdsReportCurrency(summary.currency),
    },
    entity,
    ad_account_id: account.ad_account_id,
    date_start: dateStart,
    date_end: dateEnd,
    next_page_token: nextPageToken || null,
    cached: false,
  };

  const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
  await admin.from("meta_ads_metrics_cache").upsert(
    {
      organization_id: organizationId,
      ad_account_id: account.ad_account_id,
      entity,
      date_start: dateStart,
      date_end: dateEnd,
      metrics_key: metricsKey,
      page_token: pageToken,
      response_json: responsePayload,
      fetched_at: now.toISOString(),
      expires_at: expiresAt,
    },
    {
      onConflict:
        "organization_id,ad_account_id,entity,date_start,date_end,metrics_key,page_token",
    },
  );

  return metaAdsJson({ ...responsePayload, fetched_at: now.toISOString() }, 200);
});
