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
import {
  addCpasCounts,
  applyCpasMetrics,
  deliveryLabel,
  deriveCpasFields,
  emptyCpasCounts,
  pickBudget,
  readCpasCounts,
  readStoredCpasCounts,
  type CpasCounts,
} from "../_shared/metaAdsCpasMetrics.ts";

const CACHE_TTL_MINUTES = 10;

/** Bust cache when rows include CPAS shared-item metrics. */
const METRICS_CACHE_KEY = "account-insights-v10";

/** Meta often returns empty rows for very long single-shot insights queries. */
const MAX_SINGLE_INSIGHTS_RANGE_DAYS = 92;

const MONTHLY_SPEND_CACHE_KEY = "monthly-spend-v8";

function monthlySpendCacheKey(serviceIdFilter: string | null): string {
  return serviceIdFilter
    ? `${MONTHLY_SPEND_CACHE_KEY}:svc:${serviceIdFilter}`
    : MONTHLY_SPEND_CACHE_KEY;
}

const ACCOUNT_SUMMARY_FIELDS =
  "spend,impressions,inline_link_clicks,reach,account_currency,catalog_segment_actions,catalog_segment_value";

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
  "inline_link_clicks",
  "clicks",
  "cpc",
  "cpm",
  "ctr",
  "reach",
  "frequency",
  "actions",
  "catalog_segment_actions",
  "catalog_segment_value",
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
  content_views: number;
  adds_to_cart: number;
  purchases: number;
  atc_conversion_value: number;
  purchase_conversion_value: number;
  click_to_view_rate: number | null;
  view_to_atc_rate: number | null;
  atc_to_purchase_rate: number | null;
  cost_per_atc: number | null;
  cost_per_purchase: number | null;
  aov: number | null;
  purchase_roas: number | null;
  frequency: number | null;
};

function accountSummaryFromTotals(args: {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  currency: string;
  counts: CpasCounts;
}): AccountSummary {
  const derived = deriveCpasFields({
    counts: args.counts,
    spend: args.spend,
    linkClicks: args.clicks,
    impressions: args.impressions,
    reach: args.reach,
    frequency: null,
  });
  return {
    spend: args.spend,
    impressions: args.impressions,
    clicks: args.clicks,
    reach: args.reach,
    currency: args.currency,
    content_views: derived.content_views,
    adds_to_cart: derived.adds_to_cart,
    purchases: derived.purchases,
    atc_conversion_value: derived.atc_conversion_value,
    purchase_conversion_value: derived.purchase_conversion_value,
    click_to_view_rate: derived.click_to_view_rate,
    view_to_atc_rate: derived.view_to_atc_rate,
    atc_to_purchase_rate: derived.atc_to_purchase_rate,
    cost_per_atc: derived.cost_per_atc,
    cost_per_purchase: derived.cost_per_purchase,
    aov: derived.aov,
    purchase_roas: derived.purchase_roas,
    frequency: derived.frequency,
  };
}

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

/** Match Ads Manager Link clicks, link CTR, and cost per link click. */
function applyLinkClickMetrics(row: Record<string, unknown>): void {
  const impressions = parseNumField(row.impressions);
  const spend = parseNumField(row.spend);
  const linkClicks = Math.round(parseNumField(row.inline_link_clicks));
  row.clicks = String(linkClicks);
  row.ctr = impressions > 0 ? String((linkClicks / impressions) * 100) : "0";
  row.cpc = linkClicks > 0 ? String(spend / linkClicks) : "0";
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
    const mergedCpas = deriveCpasFields({
      counts: addCpasCounts(readStoredCpasCounts(prev), readStoredCpasCounts(row)),
      spend,
      linkClicks: clicks,
      impressions,
      reach,
      frequency: null,
    });
    Object.assign(prev, mergedCpas);
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
      const record = row as Record<string, unknown>;
      applyLinkClickMetrics(record);
      applyCpasMetrics(record);
      out.push(record);
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
  let counts = emptyCpasCounts();
  for (const part of parts) {
    spend += part.spend;
    impressions += part.impressions;
    clicks += part.clicks;
    reach += part.reach;
    counts = addCpasCounts(counts, {
      contentViews: part.content_views,
      addsToCart: part.adds_to_cart,
      purchases: part.purchases,
      atcConversionValue: part.atc_conversion_value,
      purchaseConversionValue: part.purchase_conversion_value,
    });
    if (part.currency) currency = metaAdsReportCurrency(part.currency);
  }

  return accountSummaryFromTotals({ spend, impressions, clicks, reach, currency, counts });
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
  let counts = emptyCpasCounts();

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
        inline_link_clicks?: string;
        reach?: string;
        account_currency?: string;
        catalog_segment_actions?: unknown;
        catalog_segment_value?: unknown;
      };
      spend += parseFloat(r.spend ?? "0") || 0;
      impressions += parseInt(r.impressions ?? "0", 10) || 0;
      clicks += parseInt(r.inline_link_clicks ?? "0", 10) || 0;
      reach += parseInt(r.reach ?? "0", 10) || 0;
      counts = addCpasCounts(counts, readCpasCounts(r));
      if (r.account_currency) currency = metaAdsReportCurrency(r.account_currency);
    }

    const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
    const after = paging?.cursors?.after;
    if (!after) break;
    path =
      `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_range=${timeRangeEncoded}&limit=500&after=${encodeURIComponent(after)}`;
  }

  return accountSummaryFromTotals({ spend, impressions, clicks, reach, currency, counts });
}

const META_OBJECT_ID_CHUNK = 50;

async function fetchMetaObjectsByIds(
  graphVersion: string,
  ids: string[],
  fields: string,
  accessToken: string,
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];

  for (let i = 0; i < unique.length; i += META_OBJECT_ID_CHUNK) {
    const slice = unique.slice(i, i + META_OBJECT_ID_CHUNK);
    const path =
      `?ids=${encodeURIComponent(slice.join(","))}&fields=${encodeURIComponent(fields)}`;
    const url =
      `https://graph.facebook.com/${graphVersion}/${path}&access_token=${encodeURIComponent(accessToken)}`;
    try {
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json || typeof json !== "object" || Array.isArray(json)) {
        const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
        console.warn("fetchMetaObjectsByIds:", msg);
        continue;
      }
      for (const [id, value] of Object.entries(json as Record<string, unknown>)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        if ("error" in value) continue;
        map.set(id, value as Record<string, unknown>);
      }
    } catch (e) {
      console.warn("fetchMetaObjectsByIds:", e);
    }
  }

  return map;
}

function insightRowId(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? "").trim();
}

function learningStageStatus(source: Record<string, unknown> | undefined): unknown {
  const info = source?.learning_stage_info;
  if (!info || typeof info !== "object" || Array.isArray(info)) return undefined;
  return (info as { status?: unknown }).status;
}

function writeDeliveryAndBudget(
  row: Record<string, unknown>,
  statusSource: Record<string, unknown> | undefined,
  budgetSource: Record<string, unknown> | undefined,
  fallbackCurrency: string,
  campaignBudgetSource?: Record<string, unknown>,
): void {
  if (statusSource) {
    row.delivery = deliveryLabel(statusSource.effective_status, learningStageStatus(statusSource));
  }
  const currency = String(row.account_currency ?? fallbackCurrency ?? "IDR");
  const ownBudget = budgetSource
    ? pickBudget(budgetSource.daily_budget, budgetSource.lifetime_budget, currency)
    : null;
  if (ownBudget != null) {
    row.budget = ownBudget;
    delete row.budget_uses_campaign;
    return;
  }
  row.budget = null;
  const campaignBudget = campaignBudgetSource
    ? pickBudget(campaignBudgetSource.daily_budget, campaignBudgetSource.lifetime_budget, currency)
    : null;
  if (campaignBudget != null) row.budget_uses_campaign = true;
  else delete row.budget_uses_campaign;
}

/** Delivery and budget come from the campaign or ad set object, not insights. */
async function enrichRowsWithDeliveryAndBudget(
  graphVersion: string,
  entity: MetricEntity,
  rows: Record<string, unknown>[],
  accessToken: string,
  currency: string,
): Promise<void> {
  if (rows.length === 0) return;

  if (entity === "campaign") {
    const objects = await fetchMetaObjectsByIds(
      graphVersion,
      rows.map((row) => insightRowId(row, "campaign_id")),
      "effective_status,daily_budget,lifetime_budget",
      accessToken,
    );
    for (const row of rows) {
      const obj = objects.get(insightRowId(row, "campaign_id"));
      writeDeliveryAndBudget(row, obj, obj, currency);
    }
    return;
  }

  if (entity === "adset") {
    const adsetIds = rows.map((row) => insightRowId(row, "adset_id"));
    let adsets = await fetchMetaObjectsByIds(
      graphVersion,
      adsetIds,
      "effective_status,daily_budget,lifetime_budget,learning_stage_info",
      accessToken,
    );
    if (adsets.size === 0) {
      adsets = await fetchMetaObjectsByIds(
        graphVersion,
        adsetIds,
        "effective_status,daily_budget,lifetime_budget",
        accessToken,
      );
    }
    const campaignIds = rows
      .filter((row) => {
        const adset = adsets.get(insightRowId(row, "adset_id"));
        return (
          pickBudget(adset?.daily_budget, adset?.lifetime_budget, currency) == null
        );
      })
      .map((row) => insightRowId(row, "campaign_id"));
    const campaigns = await fetchMetaObjectsByIds(
      graphVersion,
      campaignIds,
      "daily_budget,lifetime_budget",
      accessToken,
    );
    for (const row of rows) {
      const adset = adsets.get(insightRowId(row, "adset_id"));
      writeDeliveryAndBudget(
        row,
        adset,
        adset,
        currency,
        campaigns.get(insightRowId(row, "campaign_id")),
      );
    }
    return;
  }

  const [ads, adsets] = await Promise.all([
    fetchMetaObjectsByIds(
      graphVersion,
      rows.map((row) => insightRowId(row, "ad_id")),
      "effective_status,status,created_time",
      accessToken,
    ),
    fetchMetaObjectsByIds(
      graphVersion,
      rows.map((row) => insightRowId(row, "adset_id")),
      "effective_status,daily_budget,lifetime_budget,learning_stage_info",
      accessToken,
    ),
  ]);
  const campaignIds = rows
    .filter((row) => {
      const adset = adsets.get(insightRowId(row, "adset_id"));
      return pickBudget(adset?.daily_budget, adset?.lifetime_budget, currency) == null;
    })
    .map((row) => insightRowId(row, "campaign_id"));
  const campaigns = await fetchMetaObjectsByIds(
    graphVersion,
    campaignIds,
    "daily_budget,lifetime_budget",
    accessToken,
  );
  for (const row of rows) {
    const ad = ads.get(insightRowId(row, "ad_id"));
    const adset = adsets.get(insightRowId(row, "adset_id"));
    const statusSource = ad ? { ...ad } : undefined;
    if (
      statusSource &&
      String(ad?.effective_status ?? "").trim().toUpperCase() === "ACTIVE" &&
      adset?.learning_stage_info
    ) {
      statusSource.learning_stage_info = adset.learning_stage_info;
    }
    writeDeliveryAndBudget(
      row,
      statusSource,
      adset,
      currency,
      campaigns.get(insightRowId(row, "campaign_id")),
    );
    const created = ad?.created_time;
    if (created != null && String(created).trim() !== "") row.created_time = String(created);
    const configured = String(ad?.status ?? "").trim().toUpperCase();
    if (configured) row.configured_status = configured;
  }
}

/** Days-running column reads the ad's created_time. Cached insight rows may not have it yet. */
async function attachAdCreatedTimes(
  graphVersion: string,
  rows: Record<string, unknown>[],
  accessToken: string,
): Promise<void> {
  const missing = rows.filter(
    (row) => !String(row.created_time ?? "").trim() || !String(row.configured_status ?? "").trim(),
  );
  if (missing.length === 0) return;
  const ads = await fetchMetaObjectsByIds(
    graphVersion,
    missing.map((row) => insightRowId(row, "ad_id")),
    "created_time,status",
    accessToken,
  );
  for (const row of missing) {
    const ad = ads.get(insightRowId(row, "ad_id"));
    const created = ad?.created_time;
    if (created != null && String(created).trim() !== "") row.created_time = String(created);
    const configured = String(ad?.status ?? "").trim().toUpperCase();
    if (configured) row.configured_status = configured;
  }
}

type MonthlySpendBucket = {
  year: number;
  month: number;
  spend: number;
  platform_results: number;
};

function spendBucketsFromWindows(monthWindows: MonthWindow[]): MonthlySpendBucket[] {
  return emptySpendBucketsForWindows(monthWindows).map((bucket) => ({
    ...bucket,
    platform_results: 0,
  }));
}

function addMonthlyPurchases(
  bucket: MonthlySpendBucket,
  catalogSegmentActions: unknown,
): void {
  bucket.platform_results += readCpasCounts({
    catalog_segment_actions: catalogSegmentActions,
  }).purchases;
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
  includePurchases = true,
): Promise<{ months: MonthlySpendBucket[]; currency: string }> {
  const fields = includePurchases
    ? "spend,account_currency,date_start,date_stop,catalog_segment_actions"
    : "spend,account_currency,date_start,date_stop";
  const filtering = entityInsightsFiltering("ad");
  let path =
    `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRangeEncoded}&limit=500`;
  const bucketByKey = new Map<string, MonthlySpendBucket>();
  for (const w of monthWindows) {
    bucketByKey.set(monthPeriodKeyFromWindow(w), {
      year: w.year,
      month: w.month,
      spend: 0,
      platform_results: 0,
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
      if (includePurchases) {
        console.warn("meta monthly purchases failed, retrying spend only:", msg);
        return fetchMonthlyAdsManagerAlignedSpend(
          graphVersion,
          act,
          timeRangeEncoded,
          accessToken,
          monthWindows,
          false,
        );
      }
      throw new Error(msg);
    }

    const rows = (json as { data?: unknown[] })?.data ?? [];
    for (const row of rows) {
      const r = row as {
        spend?: string;
        account_currency?: string;
        date_start?: string;
        catalog_segment_actions?: unknown;
      };
      if (r.account_currency) currency = metaAdsReportCurrency(r.account_currency);
      const periodKey = parseMonthlyPeriodKey(String(r.date_start ?? ""));
      if (!periodKey) continue;
      const bucket = bucketByKey.get(periodKey);
      if (!bucket) continue;
      const spend = parseFloat(r.spend ?? "0") || 0;
      bucket.spend += spend;
      if (includePurchases) addMonthlyPurchases(bucket, r.catalog_segment_actions);
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
  includePurchases = true,
): Promise<{ months: MonthlySpendBucket[]; currency: string }> {
  if (allowedCampaignIds.size === 0) {
    return { months: spendBucketsFromWindows(monthWindows), currency: metaAdsReportCurrency() };
  }

  const fields = includePurchases
    ? "spend,account_currency,date_start,campaign_id,catalog_segment_actions"
    : "spend,account_currency,date_start,campaign_id";
  const filtering = entityInsightsFiltering("campaign");
  let path =
    `${act}/insights?fields=${fields}&level=campaign&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRangeEncoded}&limit=500`;
  const bucketByKey = new Map<string, MonthlySpendBucket>();
  for (const w of monthWindows) {
    bucketByKey.set(monthPeriodKeyFromWindow(w), {
      year: w.year,
      month: w.month,
      spend: 0,
      platform_results: 0,
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
      if (includePurchases) {
        console.warn("meta monthly purchases failed, retrying spend only:", msg);
        return fetchMonthlyCampaignFilteredSpend(
          graphVersion,
          act,
          timeRangeEncoded,
          accessToken,
          monthWindows,
          allowedCampaignIds,
          false,
        );
      }
      throw new Error(msg);
    }

    const rows = (json as { data?: unknown[] })?.data ?? [];
    for (const row of rows) {
      const r = row as {
        spend?: string;
        account_currency?: string;
        date_start?: string;
        campaign_id?: string;
        catalog_segment_actions?: unknown;
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
      if (includePurchases) addMonthlyPurchases(bucket, r.catalog_segment_actions);
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

async function patchCachedAdStatus(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  adAccountId: string,
  adId: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const { data } = await admin
    .from("meta_ads_metrics_cache")
    .select("id, response_json")
    .eq("organization_id", organizationId)
    .eq("ad_account_id", adAccountId)
    .eq("entity", "ad");
  if (!data) return;
  for (const entry of data) {
    const payload = entry.response_json as { rows?: Record<string, unknown>[] } | null;
    if (!payload || !Array.isArray(payload.rows)) continue;
    let changed = false;
    for (const row of payload.rows) {
      if (String(row.ad_id ?? "").trim() !== adId) continue;
      row.configured_status = status;
      row.delivery = status === "ACTIVE" ? "Active" : "Off";
      changed = true;
    }
    if (!changed) continue;
    await admin.from("meta_ads_metrics_cache").update({ response_json: payload }).eq("id", entry.id);
  }
}

async function handleSetAdStatus(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<Response> {
  const adId = String(body.ad_id ?? "").trim();
  const status = String(body.status ?? "").trim().toUpperCase();
  if (!/^\d+$/.test(adId)) return metaAdsJson({ error: "ad_id is required" }, 400);
  if (status !== "ACTIVE" && status !== "PAUSED") {
    return metaAdsJson({ error: "status must be ACTIVE or PAUSED" }, 400);
  }

  const adAccountIdParam = body.ad_account_id != null ? String(body.ad_account_id).trim() : null;
  const resolved = await resolveOrgMetaAdsForMetrics(admin, organizationId, adAccountIdParam);
  if (!resolved) {
    return metaAdsJson({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const { accessToken, account } = resolved;
  const version = metaGraphVersion();
  const lookupUrl =
    `https://graph.facebook.com/${version}/${adId}?fields=id,account_id&access_token=${encodeURIComponent(accessToken)}`;
  const lookupRes = await fetch(lookupUrl);
  const lookupJson = await lookupRes.json().catch(() => ({}));
  if (!lookupRes.ok) {
    const msg = (lookupJson as { error?: { message?: string } })?.error?.message ??
      `HTTP ${lookupRes.status}`;
    return metaAdsJson({ error: msg }, 400);
  }
  const ownedAccount = String((lookupJson as { account_id?: unknown }).account_id ?? "").replace(/\D/g, "");
  const expectedAccount = String(account.ad_account_id ?? "").replace(/\D/g, "");
  if (!ownedAccount || ownedAccount !== expectedAccount) {
    return metaAdsJson({ error: "Ad is not in this ad account" }, 403);
  }

  const updateBody = new URLSearchParams({ status, access_token: accessToken });
  const updateRes = await fetch(`https://graph.facebook.com/${version}/${adId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: updateBody,
  });
  const updateJson = await updateRes.json().catch(() => ({}));
  if (!updateRes.ok) {
    const msg = (updateJson as { error?: { message?: string } })?.error?.message ??
      `HTTP ${updateRes.status}`;
    return metaAdsJson({ error: msg }, 400);
  }

  try {
    await patchCachedAdStatus(admin, organizationId, account.ad_account_id, adId, status);
  } catch (e) {
    console.warn("patchCachedAdStatus:", e);
  }

  return metaAdsJson({ ad_id: adId, status }, 200);
}

async function handleFetchAdsetAudience(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  organizationId: string,
): Promise<Response> {
  const adsetId = String(body.adset_id ?? "").trim();
  if (!/^\d+$/.test(adsetId)) {
    return metaAdsJson({ error: "adset_id is required" }, 400);
  }

  const adAccountIdParam = body.ad_account_id != null ? String(body.ad_account_id).trim() : null;
  const resolved = await resolveOrgMetaAdsForMetrics(admin, organizationId, adAccountIdParam);
  if (!resolved) {
    return metaAdsJson({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const { accessToken } = resolved;
  const version = metaGraphVersion();
  const fields = encodeURIComponent("name,targeting");
  const objectUrl =
    `https://graph.facebook.com/${version}/${adsetId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;

  try {
    const objectRes = await fetch(objectUrl);
    const objectJson = await objectRes.json().catch(() => ({}));
    if (!objectRes.ok) {
      const msg = (objectJson as { error?: { message?: string } })?.error?.message ??
        `HTTP ${objectRes.status}`;
      return metaAdsJson({ error: msg }, 400);
    }

    const sentenceLines = await fetchAdsetSentenceLines(version, adsetId, accessToken);
    const targeting = (objectJson as { targeting?: unknown }).targeting;
    return metaAdsJson({
      adset_id: adsetId,
      name: String((objectJson as { name?: unknown }).name ?? ""),
      targeting: targeting && typeof targeting === "object" ? targeting : null,
      sentence_lines: sentenceLines,
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load ad set audience";
    return metaAdsJson({ error: msg }, 400);
  }
}

async function fetchAdsetSentenceLines(
  version: string,
  adsetId: string,
  accessToken: string,
): Promise<Array<{ content?: string; children?: string[] }>> {
  const url =
    `https://graph.facebook.com/${version}/${adsetId}/targetingsentencelines?access_token=${encodeURIComponent(accessToken)}`;
  try {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    const record = json as {
      data?: unknown;
      targetingsentencelines?: unknown;
    };
    const raw = Array.isArray(record.targetingsentencelines)
      ? record.targetingsentencelines
      : Array.isArray(record.data)
        ? record.data
        : [];
    return raw.filter((item) => item && typeof item === "object") as Array<{
      content?: string;
      children?: string[];
    }>;
  } catch {
    return [];
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

  if (action === "fetchAdsetAudience") {
    return await handleFetchAdsetAudience(admin, body, organizationId);
  }

  if (action === "setAdStatus") {
    return await handleSetAdStatus(admin, body, organizationId);
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
      if (entity === "ad" && cachedRows.length > 0) {
        try {
          await attachAdCreatedTimes(metaGraphVersion(), cachedRows, accessToken);
        } catch (e) {
          console.warn("attachAdCreatedTimes:", e);
        }
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
      for (const row of rows) {
        applyLinkClickMetrics(row);
        applyCpasMetrics(row);
      }
      const paging = (json as { paging?: { cursors?: { after?: string } } })?.paging;
      nextPageToken = paging?.cursors?.after ?? "";
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load insights";
    return metaAdsJson({ error: msg }, 400);
  }

  try {
    await enrichRowsWithDeliveryAndBudget(v, entity, rows, accessToken, summary.currency);
  } catch (e) {
    console.warn("enrichRowsWithDeliveryAndBudget:", e);
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
      content_views: summary.content_views,
      adds_to_cart: summary.adds_to_cart,
      purchases: summary.purchases,
      atc_conversion_value: summary.atc_conversion_value,
      purchase_conversion_value: summary.purchase_conversion_value,
      click_to_view_rate: summary.click_to_view_rate,
      view_to_atc_rate: summary.view_to_atc_rate,
      atc_to_purchase_rate: summary.atc_to_purchase_rate,
      cost_per_atc: summary.cost_per_atc,
      cost_per_purchase: summary.cost_per_purchase,
      aov: summary.aov,
      purchase_roas: summary.purchase_roas,
      frequency: summary.frequency,
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
