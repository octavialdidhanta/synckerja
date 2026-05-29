import {
  adCreativeToPreviewLine,
  extractAdCreative,
} from "./googleAdsAdCreative.ts";
import { METRIC_CATALOG } from "./googleAdsMetricsCatalog/metricsData.ts";

export type {
  MetricCategory,
  MetricDef,
  MetricEntity,
  MetricValueKind,
} from "./googleAdsMetricsCatalog/types.ts";

export {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DEFAULT_METRIC_KEYS,
  IDENTITY_COLUMNS_API,
  KEYWORD_VIEW_EXCLUDED_METRIC_KEYS,
  MAX_METRICS_PER_REQUEST,
  RECOMMENDED_METRIC_KEYS,
} from "./googleAdsMetricsCatalog/types.ts";

export { getMetricCatalog, getMetricCatalogForApi } from "./googleAdsMetricsCatalog/catalogApi.ts";

import type { MetricDef, MetricEntity, MetricValueKind } from "./googleAdsMetricsCatalog/types.ts";
import {
  DEFAULT_METRIC_KEYS,
  KEYWORD_VIEW_EXCLUDED_METRIC_KEYS,
  MAX_METRICS_PER_REQUEST,
} from "./googleAdsMetricsCatalog/types.ts";


const METRIC_BY_KEY = new Map(METRIC_CATALOG.map((m) => [m.key, m]));


export function buildMetricsKey(keys: string[]): string {
  return [...keys].sort().join("|");
}

/** Never warn the UI about keyword_view metrics Google cannot return (expected omission). */
export function filterClientUnsupportedMetrics(
  entity: MetricEntity,
  keys: string[],
): string[] {
  if (entity !== "keyword") return keys;
  return keys.filter((k) => !KEYWORD_VIEW_EXCLUDED_METRIC_KEYS.has(k));
}

export function resolveMetrics(
  keys: string[],
  entity: MetricEntity,
): { defs: MetricDef[]; invalid: string[] } {
  const invalid: string[] = [];
  const defs: MetricDef[] = [];
  const seen = new Set<string>();

  for (const raw of keys) {
    const key = String(raw).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const def = METRIC_BY_KEY.get(key);
    if (!def) {
      invalid.push(key);
      continue;
    }
    if (!def.entities.includes(entity)) {
      invalid.push(key);
      continue;
    }
    defs.push(def);
  }

  if (defs.length === 0) {
    for (const key of DEFAULT_METRIC_KEYS) {
      const def = METRIC_BY_KEY.get(key);
      if (def && def.entities.includes(entity)) defs.push(def);
    }
  }

  return { defs, invalid };
}

export function validateMetricsCount(keys: string[]): string | null {
  const unique = [...new Set(keys.map((k) => String(k).trim()).filter(Boolean))];
  if (unique.length > MAX_METRICS_PER_REQUEST) {
    return `Maximum ${MAX_METRICS_PER_REQUEST} metrics per request`;
  }
  return null;
}

const IDENTITY_SELECT: Record<MetricEntity, string[]> = {
  campaign: [
    "campaign.id",
    "campaign.name",
    "campaign.status",
    "campaign.advertising_channel_type",
  ],
  ad_group: [
    "ad_group.id",
    "ad_group.name",
    "ad_group.status",
    "campaign.id",
    "campaign.name",
  ],
  ad: [
    "ad_group_ad.ad.id",
    "ad_group_ad.status",
    "ad_group_ad.ad.type",
    "ad_group_ad.ad.name",
    "ad_group_ad.ad.expanded_text_ad.headline_part1",
    "ad_group_ad.ad.expanded_text_ad.headline_part2",
    "ad_group_ad.ad.expanded_text_ad.headline_part3",
    "ad_group_ad.ad.expanded_text_ad.description",
    "ad_group_ad.ad.expanded_text_ad.description2",
    "ad_group_ad.ad.final_urls",
    "ad_group_ad.ad.responsive_search_ad.headlines",
    "ad_group_ad.ad.responsive_search_ad.descriptions",
    "ad_group.name",
    "campaign.name",
  ],
  keyword: [
    "ad_group_criterion.criterion_id",
    "ad_group_criterion.keyword.text",
    "ad_group_criterion.keyword.match_type",
    "ad_group_criterion.status",
    "ad_group.id",
    "ad_group.name",
    "campaign.id",
    "campaign.name",
    "campaign.status",
  ],
};

/** Scalar-only identity (no nested ad-type fields) â€” GAQL fallback when creative fields fail. */
const AD_IDENTITY_MINIMAL: string[] = [
  "ad_group_ad.ad.id",
  "ad_group_ad.status",
  "ad_group_ad.ad.type",
  "ad_group_ad.ad.name",
  "ad_group.name",
  "campaign.name",
];

const STATUS_WHERE: Record<MetricEntity, string> = {
  campaign: "campaign.status = 'ENABLED'",
  ad_group: "ad_group.status = 'ENABLED'",
  ad: "ad_group_ad.status = 'ENABLED'",
  keyword: "ad_group_criterion.status = 'ENABLED'",
};

const FROM_RESOURCE: Record<MetricEntity, string> = {
  campaign: "campaign",
  ad_group: "ad_group",
  ad: "ad_group_ad",
  keyword: "keyword_view",
};

/** UI identity column key → GAQL ORDER BY field (already in identity SELECT). */
export const IDENTITY_SORT_GAQL: Record<MetricEntity, Record<string, string>> = {
  campaign: {
    name: "campaign.name",
    status: "campaign.status",
    channel: "campaign.advertising_channel_type",
  },
  ad_group: {
    name: "ad_group.name",
    campaign: "campaign.name",
    status: "ad_group.status",
  },
  keyword: {
    keyword: "ad_group_criterion.keyword.text",
    match_type: "ad_group_criterion.keyword.match_type",
    campaign: "campaign.name",
    ad_group: "ad_group.name",
    status: "ad_group_criterion.status",
  },
  ad: {
    preview: "ad_group_ad.ad.name",
    status: "ad_group_ad.status",
  },
};

export function isIdentitySortField(entity: MetricEntity, field: string): boolean {
  return Boolean(IDENTITY_SORT_GAQL[entity]?.[field]);
}

/** Google Ads KeywordMatchType enum (numeric API values). */
const MATCH_TYPE_BY_NUMBER: Record<number, string> = {
  2: "exact",
  3: "phrase",
  4: "broad",
};

/** Canonical lowercase key for sorting — keep in sync with `formatKeywordMatchType.ts` on web. */
export function formatKeywordMatchTypeForSort(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const mapped = MATCH_TYPE_BY_NUMBER[raw];
    if (mapped) return mapped;
  }
  const s = String(raw).trim();
  if (!s) return "";
  const asNum = Number(s);
  if (Number.isFinite(asNum) && MATCH_TYPE_BY_NUMBER[asNum]) {
    return MATCH_TYPE_BY_NUMBER[asNum];
  }
  return s
    .replace(/^KEYWORD_MATCH_TYPE_/i, "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function identitySortValue(
  entity: MetricEntity,
  identity: Record<string, unknown>,
  field: string,
): string {
  switch (entity) {
    case "keyword":
      if (field === "keyword") return String(identity.keyword_text ?? "").toLowerCase();
      if (field === "match_type") {
        return formatKeywordMatchTypeForSort(identity.match_type);
      }
      if (field === "campaign") return String(identity.campaign_name ?? "");
      if (field === "ad_group") return String(identity.ad_group_name ?? "");
      if (field === "status") return String(identity.status ?? "");
      break;
    case "campaign":
      if (field === "name") return String(identity.name ?? "");
      if (field === "status") return String(identity.status ?? "");
      if (field === "channel") return String(identity.channel_type ?? "");
      break;
    case "ad_group":
      if (field === "name") return String(identity.name ?? "");
      if (field === "campaign") return String(identity.campaign_name ?? "");
      if (field === "status") return String(identity.status ?? "");
      break;
    case "ad":
      if (field === "preview") {
        return String(identity.ad_preview ?? identity.ad_type ?? "");
      }
      if (field === "status") return String(identity.status ?? "");
      break;
  }
  return "";
}

function metricSortNumber(
  value: number | null | undefined,
  ascending: boolean,
): number {
  if (value == null || !Number.isFinite(value)) {
    return ascending ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }
  return value;
}

/** Sort full result set in memory (identity + metric columns), then slice for Show rows. */
export function sortNormalizedMetricsRows<
  T extends { id: string; identity: Record<string, unknown>; metrics: Record<string, number | null> },
>(
  rows: T[],
  sortKey: string,
  entity: MetricEntity,
): T[] {
  const [field, dirRaw] = sortKey.split(":");
  const ascending = dirRaw === "asc";
  const dir = ascending ? 1 : -1;
  const sortByIdentity = isIdentitySortField(entity, field);

  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortByIdentity) {
      const as = identitySortValue(entity, a.identity, field);
      const bs = identitySortValue(entity, b.identity, field);
      cmp = as.localeCompare(bs, undefined, { sensitivity: "base", numeric: true });
    } else {
      const an = metricSortNumber(a.metrics[field], ascending);
      const bn = metricSortNumber(b.metrics[field], ascending);
      if (an < bn) cmp = -1;
      else if (an > bn) cmp = 1;
    }
    if (cmp !== 0) return cmp * dir;
    return a.id.localeCompare(b.id) * dir;
  });
}

export function paginateMetricsRows<T>(
  rows: T[],
  pageOffset: number,
  pageSize: number,
): { pageRows: T[]; totalRowCount: number; nextOffset: number | null } {
  const totalRowCount = rows.length;
  const safeOffset = Math.max(0, Math.min(pageOffset, totalRowCount));
  const pageRows = rows.slice(safeOffset, safeOffset + pageSize);
  const nextOffset = safeOffset + pageSize < totalRowCount ? safeOffset + pageSize : null;
  return { pageRows, totalRowCount, nextOffset };
}

export type GoogleAdsMetricsSummaryTotals = {
  impressions: number;
  clicks: number;
  spent: number;
  /** Aggregate CTR = clicks / impressions (fraction); null when no impressions. */
  ctr: number | null;
  conversions: number;
  /** Aggregated values for metrics fetched in the report (catalog + conversion actions). */
  by_key: Record<string, number | null>;
};

export const SUMMARY_METRIC_KEYS = ["impressions", "clicks", "spent", "conversions"] as const;

function sumMetricValue(metrics: Record<string, number | null>, key: string): number {
  const n = Number(metrics[key]);
  return Number.isFinite(n) ? n : 0;
}

function isRateLikeMetricKey(key: string, valueKind?: MetricValueKind): boolean {
  if (key === "ctr" || key.endsWith("_rate") || key.endsWith("_share")) return true;
  return valueKind === "rate" || valueKind === "fraction";
}

/** Sum KPI metrics across the full filtered result set (not a single table page). */
export function computeSummaryTotals(rows: NormalizedMetricsRow[]): GoogleAdsMetricsSummaryTotals {
  let impressions = 0;
  let clicks = 0;
  let spent = 0;
  let conversions = 0;
  const sums: Record<string, number> = {};
  const rateSums: Record<string, number> = {};
  const rateCounts: Record<string, number> = {};

  for (const row of rows) {
    impressions += sumMetricValue(row.metrics, "impressions");
    clicks += sumMetricValue(row.metrics, "clicks");
    spent += sumMetricValue(row.metrics, "spent");
    conversions += sumMetricValue(row.metrics, "conversions");

    for (const [key, raw] of Object.entries(row.metrics)) {
      if (raw == null || !Number.isFinite(raw)) continue;
      const def = METRIC_BY_KEY.get(key);
      if (isRateLikeMetricKey(key, def?.valueKind)) {
        rateSums[key] = (rateSums[key] ?? 0) + raw;
        rateCounts[key] = (rateCounts[key] ?? 0) + 1;
      } else {
        sums[key] = (sums[key] ?? 0) + raw;
      }
    }
  }

  const ctr = impressions > 0 ? clicks / impressions : null;
  const by_key: Record<string, number | null> = { ...sums };
  by_key.impressions = impressions;
  by_key.clicks = clicks;
  by_key.spent = spent;
  by_key.conversions = conversions;
  by_key.ctr = ctr;
  for (const key of Object.keys(rateSums)) {
    if (key === "ctr") continue;
    const n = rateCounts[key] ?? 0;
    by_key[key] = n > 0 ? rateSums[key]! / n : null;
  }

  return { impressions, clicks, spent, ctr, conversions, by_key };
}

/** Ensure summary-bar metrics (and defaults) are included in GAQL fetch. */
export function ensureSummaryFetchMetricDefs(
  metricDefs: MetricDef[],
  entity: MetricEntity,
  extraKeys?: string | string[],
): MetricDef[] {
  let out = ensureSummaryMetricDefs(metricDefs, entity);
  const keys = (
    Array.isArray(extraKeys) ? extraKeys : extraKeys ? [extraKeys] : []
  )
    .map((k) => String(k).trim())
    .filter(Boolean);
  const seen = new Set(out.map((d) => d.key));
  for (const key of keys) {
    if (seen.has(key)) continue;
    const def = METRIC_BY_KEY.get(key);
    if (!def || !def.entities.includes(entity)) continue;
    if (entity === "keyword" && KEYWORD_VIEW_EXCLUDED_METRIC_KEYS.has(key)) continue;
    out = [...out, def];
    seen.add(key);
  }
  return out;
}

/** Include sort metric in GAQL fetch even when hidden from the column picker. */
export function ensureSortMetricDefs(
  metricDefs: MetricDef[],
  sortKey: string,
  entity: MetricEntity,
): MetricDef[] {
  const field = sortKey.split(":")[0] ?? "";
  if (!field || isIdentitySortField(entity, field)) return metricDefs;
  if (metricDefs.some((d) => d.key === field)) return metricDefs;
  const def = METRIC_BY_KEY.get(field);
  if (!def || !def.entities.includes(entity)) return metricDefs;
  if (entity === "keyword" && KEYWORD_VIEW_EXCLUDED_METRIC_KEYS.has(field)) return metricDefs;
  return [...metricDefs, def];
}

/** Include summary-bar metrics in GAQL fetch even when not in the column picker. */
export function ensureSummaryMetricDefs(
  metricDefs: MetricDef[],
  entity: MetricEntity,
): MetricDef[] {
  let out = [...metricDefs];
  for (const key of SUMMARY_METRIC_KEYS) {
    if (out.some((d) => d.key === key)) continue;
    const def = METRIC_BY_KEY.get(key);
    if (!def || !def.entities.includes(entity)) continue;
    if (entity === "keyword" && KEYWORD_VIEW_EXCLUDED_METRIC_KEYS.has(key)) continue;
    out = [...out, def];
  }
  return out;
}

export type GaqlBuildOptions = {
  /** When true, ad entity uses minimal identity fields only (no ETA nested fields). */
  adIdentityMinimal?: boolean;
  /** Daily rows for correct summation across stacked historical date windows. */
  segmentByDate?: boolean;
  /** GAQL metrics required in SELECT (e.g. ORDER BY field not in visible columns). */
  additionalGaqlFields?: string[];
};

export function buildSelectClause(
  entity: MetricEntity,
  metricDefs: MetricDef[],
  options?: GaqlBuildOptions,
): string {
  const identity =
    entity === "ad" && options?.adIdentityMinimal
      ? AD_IDENTITY_MINIMAL
      : IDENTITY_SELECT[entity];
  const fields = [
    ...identity,
    "customer.currency_code",
    ...(options?.segmentByDate ? ["segments.date"] : []),
    ...metricDefs.map((m) => m.gaqlField),
    ...(options?.additionalGaqlFields ?? []),
  ];
  return [...new Set(fields)].join(", ");
}

export function buildSortField(
  sortKey: string,
  entity: MetricEntity,
  metricDefs: MetricDef[],
): string {
  const [field] = sortKey.split(":");
  const identityGaql = IDENTITY_SORT_GAQL[entity]?.[field];
  if (identityGaql) return identityGaql;
  const def = METRIC_BY_KEY.get(field) ?? metricDefs.find((m) => m.key === field);
  if (def?.sortable) return def.gaqlField;
  const spent = METRIC_BY_KEY.get("spent");
  return spent?.gaqlField ?? "metrics.impressions";
}

/** Parse resource id from API value or composite row key `{customerId}-{resourceId}`. */
export function parseGoogleAdsResourceId(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const lastDash = s.lastIndexOf("-");
  if (lastDash > 0 && lastDash < s.length - 1) {
    const tail = s.slice(lastDash + 1).replace(/\D/g, "");
    if (tail.length >= 8 && tail.length <= 20) return tail;
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 20) return digits;
  return "";
}

export function buildGaqlQuery(opts: {
  entity: MetricEntity;
  metricDefs: MetricDef[];
  dateClause: string;
  statusFilter: "all" | "enabled_only";
  sortKey: string;
  pageSize: number;
  adIdentityMinimal?: boolean;
  segmentByDate?: boolean;
  /** When set, limits rows to one campaign (resource id only, not composite). */
  campaignFilterId?: string;
  /** When set, limits rows to one ad group (resource id only, not composite). */
  adGroupFilterId?: string;
}): string {
  const [sortField] = opts.sortKey.split(":");
  // Identity sort is applied in memory after full fetch; keep GAQL order stable.
  const orderField = isIdentitySortField(opts.entity, sortField)
    ? opts.entity === "keyword"
      ? "ad_group_criterion.criterion_id"
      : opts.entity === "campaign"
        ? "campaign.id"
        : opts.entity === "ad_group"
          ? "ad_group.id"
          : "ad_group_ad.ad.id"
    : buildSortField(opts.sortKey, opts.entity, opts.metricDefs);
  const identityForSelect =
    opts.entity === "ad" && opts.adIdentityMinimal
      ? AD_IDENTITY_MINIMAL
      : IDENTITY_SELECT[opts.entity];
  const selectedGaql = new Set([
    ...identityForSelect,
    ...opts.metricDefs.map((m) => m.gaqlField),
  ]);
  const additionalGaqlFields = selectedGaql.has(orderField) ? [] : [orderField];

  const select = buildSelectClause(opts.entity, opts.metricDefs, {
    adIdentityMinimal: opts.adIdentityMinimal,
    segmentByDate: opts.segmentByDate,
    additionalGaqlFields,
  });
  const from = FROM_RESOURCE[opts.entity];
  const parts = [`SELECT ${select}`, `FROM ${from}`, `WHERE ${opts.dateClause}`];
  const campaignId = parseGoogleAdsResourceId(opts.campaignFilterId);
  if (campaignId && opts.entity === "campaign") {
    parts.push(`AND campaign.id = '${campaignId}'`);
  }
  if (
    campaignId &&
    (opts.entity === "ad_group" || opts.entity === "ad" || opts.entity === "keyword")
  ) {
    parts.push(`AND campaign.id = '${campaignId}'`);
  }
  const adGroupId = parseGoogleAdsResourceId(opts.adGroupFilterId);
  if (
    adGroupId &&
    (opts.entity === "ad_group" || opts.entity === "ad" || opts.entity === "keyword")
  ) {
    parts.push(`AND ad_group.id = '${adGroupId}'`);
  }
  if (opts.entity === "keyword") {
    appendKeywordScopeFilters(parts, opts.statusFilter);
  } else if (opts.statusFilter === "enabled_only") {
    parts.push(`AND ${STATUS_WHERE[opts.entity]}`);
  }
  const direction = opts.sortKey.endsWith(":asc") ? "ASC" : "DESC";
  parts.push(`ORDER BY ${orderField} ${direction}`);
  parts.push(`LIMIT ${opts.pageSize}`);
  return parts.join("\n");
}

/** Google Ads â€œKeyword/Campaign status: Allâ€ = positive keywords, any status (incl. REMOVED). */
function appendKeywordScopeFilters(
  parts: string[],
  statusFilter: "all" | "enabled_only",
): void {
  parts.push("AND ad_group_criterion.type = 'KEYWORD'");
  parts.push("AND ad_group_criterion.negative = FALSE");
  if (statusFilter === "enabled_only") {
    parts.push(`AND ${STATUS_WHERE.keyword}`);
    parts.push("AND campaign.status = 'ENABLED'");
    parts.push("AND ad_group.status = 'ENABLED'");
  }
}

const KEYWORD_INVENTORY_IDENTITY = [
  "ad_group_criterion.criterion_id",
  "ad_group_criterion.keyword.text",
  "ad_group_criterion.keyword.match_type",
  "ad_group_criterion.status",
  "ad_group.id",
  "ad_group.name",
  "campaign.id",
  "campaign.name",
  "campaign.status",
];

/** All positive keywords (no date segment) â€” matches Google Ads Keywords table row count. */
export function buildKeywordInventoryGaqlQuery(opts: {
  statusFilter: "all" | "enabled_only";
  campaignFilterId?: string;
  adGroupFilterId?: string;
  pageSize: number;
}): string {
  const select = KEYWORD_INVENTORY_IDENTITY.join(", ");
  const parts = [
    `SELECT ${select}`,
    `FROM ad_group_criterion`,
    `WHERE ad_group_criterion.type = 'KEYWORD'`,
    `AND ad_group_criterion.negative = FALSE`,
  ];
  if (opts.statusFilter === "enabled_only") {
    parts.push(`AND ${STATUS_WHERE.keyword}`);
    parts.push("AND campaign.status = 'ENABLED'");
    parts.push("AND ad_group.status = 'ENABLED'");
  }
  const campaignId = parseGoogleAdsResourceId(opts.campaignFilterId);
  if (campaignId) {
    parts.push(`AND campaign.id = '${campaignId}'`);
  }
  const adGroupId = parseGoogleAdsResourceId(opts.adGroupFilterId);
  if (adGroupId) {
    parts.push(`AND ad_group.id = '${adGroupId}'`);
  }
  parts.push("ORDER BY ad_group_criterion.criterion_id ASC");
  parts.push(`LIMIT ${opts.pageSize}`);
  return parts.join("\n");
}

function pickNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type NormalizedMetricsRow = {
  id: string;
  identity: Record<string, unknown>;
  metrics: Record<string, number | null>;
};

export function normalizeGaqlRow(
  entity: MetricEntity,
  raw: Record<string, unknown>,
  metricDefs: MetricDef[],
): NormalizedMetricsRow {
  const campaign = (raw.campaign ?? raw.Campaign) as Record<string, unknown> | undefined;
  const adGroup = (raw.adGroup ?? raw.ad_group) as Record<string, unknown> | undefined;
  const adGroupAd = raw.adGroupAd as Record<string, unknown> | undefined;
  const ad = adGroupAd?.ad as Record<string, unknown> | undefined;
  const metricsRaw = (raw.metrics ?? {}) as Record<string, unknown>;

  const identity: Record<string, unknown> = {};
  let id = "";

  if (entity === "campaign" && campaign) {
    id = String(campaign.id ?? "");
    identity.campaign_id = id;
    identity.name = campaign.name ?? "";
    identity.status = campaign.status ?? "";
    identity.channel_type = campaign.advertisingChannelType ?? campaign.advertising_channel_type ?? "";
  } else if (entity === "ad_group" && adGroup) {
    id = String(adGroup.id ?? "");
    identity.name = adGroup.name ?? "";
    identity.status = adGroup.status ?? "";
    identity.campaign_id = campaign?.id != null ? String(campaign.id) : "";
    identity.campaign_name = campaign?.name ?? "";
  } else if (entity === "ad" && adGroupAd) {
    id = String(ad?.id ?? "");
    identity.status = adGroupAd.status ?? "";
    identity.ad_type = ad?.type ?? "";
    identity.ad_group_name = adGroup?.name ?? "";
    identity.campaign_name = campaign?.name ?? "";
    const creative = extractAdCreative(ad);
    identity.ad_creative = creative;
    const preview = adCreativeToPreviewLine(creative);
    identity.ad_preview = preview || (id ? `Ad ${id}` : "");
  } else if (entity === "keyword") {
    const agc = (raw.adGroupCriterion ?? raw.ad_group_criterion) as
      | Record<string, unknown>
      | undefined;
    const kw = (agc?.keyword ?? agc?.Keyword) as Record<string, unknown> | undefined;
    id = String(agc?.criterionId ?? agc?.criterion_id ?? "");
    identity.criterion_id = id;
    identity.keyword_text = kw?.text ?? "";
    identity.match_type = kw?.matchType ?? kw?.match_type ?? "";
    identity.status = agc?.status ?? "";
    identity.ad_group_id = adGroup?.id != null ? String(adGroup.id) : "";
    identity.ad_group_name = adGroup?.name ?? "";
    identity.campaign_id = campaign?.id != null ? String(campaign.id) : "";
    identity.campaign_name = campaign?.name ?? "";
    identity.campaign_status = campaign?.status ?? "";
  }

  const metrics: Record<string, number | null> = {};
  for (const def of metricDefs) {
    const fieldName = def.gaqlField.replace(/^metrics\./, "");
    const camel = fieldName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const val = metricsRaw[fieldName] ?? metricsRaw[camel];
    if (val == null) {
      metrics[def.key] = null;
      continue;
    }
    if (def.valueKind === "micros") {
      metrics[def.key] = pickNum(val) / 1_000_000;
    } else if (def.valueKind === "rate" || def.valueKind === "fraction") {
      const n = pickNum(val);
      metrics[def.key] = n;
      if (
        def.key === "ctr" ||
        def.key.endsWith("_rate") ||
        def.valueKind === "fraction" ||
        def.key.endsWith("_share") ||
        def.key.endsWith("_pct")
      ) {
        metrics[`${def.key}_percent`] = n * 100;
      }
    } else {
      metrics[def.key] = pickNum(val);
    }
  }

  return { id, identity, metrics };
}

export function rowPassesDeliveryFilter(
  metrics: Record<string, number | null>,
  onlyRunning: boolean,
): boolean {
  if (!onlyRunning) return true;
  const impr = pickNum(metrics.impressions);
  const spent = pickNum(metrics.spent);
  return impr > 0 || spent > 0;
}

/** Stable resource id for merging rows (handles MCC composite row keys). */
export function entityResourceKey(
  entity: MetricEntity,
  row: NormalizedMetricsRow,
): string {
  if (entity === "campaign") {
    return parseGoogleAdsResourceId(String(row.identity.campaign_id ?? row.id ?? ""));
  }
  if (entity === "ad_group") {
    return parseGoogleAdsResourceId(String(row.id ?? ""));
  }
  if (entity === "keyword") {
    const compositeId = String(row.id ?? "");
    const mccMatch = /^(\d{10})-(\d+)$/.exec(compositeId);
    const customerId = mccMatch?.[1] ?? "";
    const campaignId = parseGoogleAdsResourceId(String(row.identity.campaign_id ?? ""));
    const adGroupId = parseGoogleAdsResourceId(String(row.identity.ad_group_id ?? ""));
    let criterionId = parseGoogleAdsResourceId(String(row.identity.criterion_id ?? ""));
    if (!criterionId && mccMatch?.[2] && !compositeId.includes("|")) {
      criterionId = parseGoogleAdsResourceId(mccMatch[2]);
    }
    if (!campaignId || !adGroupId || !criterionId) return "";
    const parts = [customerId, campaignId, adGroupId, criterionId].filter(Boolean);
    return parts.join("|");
  }
  return parseGoogleAdsResourceId(String(row.id ?? ""));
}

/** Sum metrics when GAQL returns multiple rows per resource (e.g. per-day slices in a page). */
export function mergeMetricsRowsByEntity(
  entity: MetricEntity,
  rows: NormalizedMetricsRow[],
): NormalizedMetricsRow[] {
  const map = new Map<string, NormalizedMetricsRow>();

  for (const row of rows) {
    const key = entityResourceKey(entity, row);
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      const displayId =
        entity === "keyword"
          ? String(row.identity.criterion_id ?? row.id ?? key)
          : key;
      map.set(key, {
        id: displayId,
        identity: { ...row.identity },
        metrics: { ...row.metrics },
      });
      continue;
    }

    for (const [metricKey, value] of Object.entries(row.metrics)) {
      if (value == null) continue;
      const prev = existing.metrics[metricKey];
      existing.metrics[metricKey] = pickNum(prev) + pickNum(value);
    }

    const impr = pickNum(existing.metrics.impressions);
    const clicks = pickNum(existing.metrics.clicks);
    if (impr > 0) {
      if (existing.metrics.ctr != null) {
        const ctr = clicks / impr;
        existing.metrics.ctr = ctr;
        existing.metrics.ctr_percent = ctr * 100;
      }
    }
  }

  return [...map.values()];
}

/**
 * Inventory (ad_group_criterion) = row list matching Google â€œstatus: Allâ€.
 * keyword_view rows only added when no inventory match (reporting-only), then deduped.
 */
export function mergeKeywordInventoryWithMetrics(
  inventory: NormalizedMetricsRow[],
  withMetrics: NormalizedMetricsRow[],
  metricDefs: MetricDef[],
): NormalizedMetricsRow[] {
  const zeroMetrics = (): Record<string, number | null> => {
    const m: Record<string, number | null> = {};
    for (const def of metricDefs) m[def.key] = null;
    return m;
  };
  const map = new Map<string, NormalizedMetricsRow>();
  const indexByCriterion = new Map<string, string>();

  for (const row of inventory) {
    const key = entityResourceKey("keyword", row);
    if (!key) continue;
    map.set(key, {
      id: row.id,
      identity: { ...row.identity },
      metrics: zeroMetrics(),
    });
    const criterionId = parseGoogleAdsResourceId(String(row.identity.criterion_id ?? ""));
    const campaignId = parseGoogleAdsResourceId(String(row.identity.campaign_id ?? ""));
    const adGroupId = parseGoogleAdsResourceId(String(row.identity.ad_group_id ?? ""));
    if (criterionId && campaignId && adGroupId) {
      indexByCriterion.set(`${campaignId}|${adGroupId}|${criterionId}`, key);
    }
  }

  for (const row of withMetrics) {
    let key = entityResourceKey("keyword", row);
    if (!key) continue;
    let existing = map.get(key);
    if (!existing) {
      const criterionId = parseGoogleAdsResourceId(String(row.identity.criterion_id ?? ""));
      const campaignId = parseGoogleAdsResourceId(String(row.identity.campaign_id ?? ""));
      const adGroupId = parseGoogleAdsResourceId(String(row.identity.ad_group_id ?? ""));
      if (criterionId && campaignId && adGroupId) {
        const altKey = indexByCriterion.get(`${campaignId}|${adGroupId}|${criterionId}`);
        if (altKey) {
          key = altKey;
          existing = map.get(altKey);
        }
      }
    }
    if (existing) {
      existing.metrics = { ...row.metrics };
      Object.assign(existing.identity, row.identity);
      const criterionId = row.identity.criterion_id;
      if (criterionId != null && String(criterionId) !== "") {
        existing.id = String(criterionId);
      }
      continue;
    }
    map.set(key, {
      id: String(row.identity.criterion_id ?? row.id ?? key),
      identity: { ...row.identity },
      metrics: { ...row.metrics },
    });
    const criterionId = parseGoogleAdsResourceId(String(row.identity.criterion_id ?? ""));
    const campaignId = parseGoogleAdsResourceId(String(row.identity.campaign_id ?? ""));
    const adGroupId = parseGoogleAdsResourceId(String(row.identity.ad_group_id ?? ""));
    if (criterionId && campaignId && adGroupId) {
      indexByCriterion.set(`${campaignId}|${adGroupId}|${criterionId}`, key);
    }
  }

  return mergeMetricsRowsByEntity("keyword", [...map.values()]);
}

/** GAQL errors that may be fixed by dropping nested ad creative fields from SELECT. */
export function isAdCreativeGaqlError(message: string): boolean {
  return /headline|expanded_text|responsive_search|prohibited|cannot be selected|unrecognized name|not allowed/i.test(
    message,
  );
}

export function parseUnsupportedMetricsFromError(message: string): string[] {
  const byField = new Map(METRIC_CATALOG.map((d) => [d.gaqlField, d.key]));
  const byShort = new Map(
    METRIC_CATALOG.map((d) => [d.gaqlField.replace(/^metrics\./, ""), d.key]),
  );
  const keys: string[] = [];

  const metricsRe = /metrics\.([a-z][a-z0-9_]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = metricsRe.exec(message)) !== null) {
    const key = byField.get(`metrics.${match[1]}`);
    if (key) keys.push(key);
  }

  const prohibitedRe = /'([a-z][a-z0-9_]*)'\s*\([^)]*could not support/gi;
  while ((match = prohibitedRe.exec(message)) !== null) {
    const key = byShort.get(match[1]!);
    if (key) keys.push(key);
  }

  return [...new Set(keys)];
}
