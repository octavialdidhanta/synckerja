import type { MetricEntity } from "./googleAdsMetricsCatalog/types.ts";
import {
  entityResourceKey,
  mergeMetricsRowsByEntity,
  normalizeGaqlRow,
  parseGoogleAdsResourceId,
  type NormalizedMetricsRow,
} from "./googleAdsMetricsCatalog.ts";
import { isUiCustomMetricKey } from "./googleAdsUiCustomColumns.ts";
import { isSynckerjaLeadsMetricKey } from "./googleAdsSynckerjaLeadsMetrics.ts";
import { isSynckerjaTrafficMetricKey } from "./googleAdsSynckerjaTrafficMetrics.ts";

export const CONV_ACTION_METRIC_PREFIX = "conv_action:";

export type CustomColumnListItem = {
  key: string;
  /** Conversion action name (short label for table/modal). */
  label: string;
  description: string;
  conversion_action_id: string;
  customer_id: string;
  /** MCC client account name, when aggregated from multiple accounts. */
  account_label?: string | null;
};

function digitsOnly(value: string, len?: number): string {
  const d = value.replace(/\D/g, "");
  if (len != null && d.length !== len) return "";
  return d;
}

export function conversionActionMetricKey(customerId: string, actionId: string): string {
  const cid = digitsOnly(customerId, 10);
  const aid = digitsOnly(actionId);
  if (!cid || !aid) return "";
  return `${CONV_ACTION_METRIC_PREFIX}${cid}:${aid}`;
}

export function parseConversionActionMetricKey(
  key: string,
): { customerId: string; actionId: string } | null {
  const raw = String(key ?? "").trim();
  if (!raw.startsWith(CONV_ACTION_METRIC_PREFIX)) return null;
  const rest = raw.slice(CONV_ACTION_METRIC_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep < 0) return null;
  const customerId = digitsOnly(rest.slice(0, sep), 10);
  const actionId = digitsOnly(rest.slice(sep + 1));
  if (!customerId || !actionId) return null;
  return { customerId, actionId };
}

export function isConversionActionMetricKey(key: string): boolean {
  return parseConversionActionMetricKey(key) != null;
}

export function splitMetricKeys(keys: string[]): {
  catalogKeys: string[];
  customKeys: string[];
  uiCustomKeys: string[];
  trafficKeys: string[];
  leadsKeys: string[];
} {
  const catalogKeys: string[] = [];
  const customKeys: string[] = [];
  const uiCustomKeys: string[] = [];
  const trafficKeys: string[] = [];
  const leadsKeys: string[] = [];
  const seen = new Set<string>();
  for (const raw of keys) {
    const key = String(raw).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (isUiCustomMetricKey(key)) uiCustomKeys.push(key);
    else if (isSynckerjaTrafficMetricKey(key)) trafficKeys.push(key);
    else if (isSynckerjaLeadsMetricKey(key)) leadsKeys.push(key);
    else if (isConversionActionMetricKey(key)) customKeys.push(key);
    else catalogKeys.push(key);
  }
  return { catalogKeys, customKeys, uiCustomKeys, trafficKeys, leadsKeys };
}

export function buildListCustomColumnsGaql(): string {
  return [
    "SELECT conversion_action.id, conversion_action.name, conversion_action.category, conversion_action.status",
    "FROM conversion_action",
    "WHERE conversion_action.status != 'REMOVED'",
    "ORDER BY conversion_action.name",
  ].join("\n");
}

export function normalizeCustomColumnListRow(
  raw: Record<string, unknown>,
  metricsCustomerId: string,
  clientLabel?: string,
): CustomColumnListItem | null {
  const ca = (raw.conversionAction ?? raw.conversion_action) as
    | Record<string, unknown>
    | undefined;
  if (!ca) return null;
  const actionId = digitsOnly(String(ca.id ?? ""));
  if (!actionId) return null;
  const name = String(ca.name ?? "").trim() || `Conversion ${actionId}`;
  const category = String(ca.category ?? "").trim();
  const status = String(ca.status ?? "").trim();
  const description = [category, status].filter(Boolean).join(" · ") || "Conversion action";
  const customerId = digitsOnly(metricsCustomerId, 10);
  const key = conversionActionMetricKey(customerId, actionId);
  if (!key) return null;
  return {
    key,
    label: name,
    description,
    conversion_action_id: actionId,
    customer_id: customerId,
    account_label: clientLabel?.trim() || null,
  };
}

function pickNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function conversionActionIdFromSegment(raw: Record<string, unknown>): string {
  const seg = (raw.segments ?? raw.Segments) as Record<string, unknown> | undefined;
  const resource = seg?.conversionAction ?? seg?.conversion_action;
  if (resource == null) return "";
  const s = String(resource).trim();
  const m = s.match(/conversionActions\/(\d+)/i);
  if (m?.[1]) return digitsOnly(m[1]);
  return digitsOnly(s);
}

export function buildConversionActionMetricsGaql(opts: {
  entity: MetricEntity;
  dateClause: string;
  statusFilter: "all" | "enabled_only";
  segmentByDate?: boolean;
  campaignFilterId?: string;
  adGroupFilterId?: string;
}): string {
  const from =
    opts.entity === "campaign"
      ? "campaign"
      : opts.entity === "ad_group"
        ? "ad_group"
        : opts.entity === "ad"
          ? "ad_group_ad"
          : "keyword_view";

  const identity =
    opts.entity === "campaign"
      ? ["campaign.id"]
      : opts.entity === "ad_group"
        ? ["ad_group.id", "campaign.id"]
        : opts.entity === "ad"
          ? ["ad_group_ad.ad.id", "ad_group.id", "campaign.id"]
          : ["ad_group_criterion.criterion_id", "ad_group.id", "campaign.id"];

  const select = [
    ...identity,
    "segments.conversion_action",
    ...(opts.segmentByDate ? ["segments.date"] : []),
    "metrics.conversions",
  ].join(", ");

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
    parts.push("AND ad_group_criterion.type = 'KEYWORD'");
    parts.push("AND ad_group_criterion.negative = FALSE");
    if (opts.statusFilter === "enabled_only") {
      parts.push("AND ad_group_criterion.status = 'ENABLED'");
      parts.push("AND campaign.status = 'ENABLED'");
      parts.push("AND ad_group.status = 'ENABLED'");
    }
  } else if (opts.statusFilter === "enabled_only") {
    const statusField =
      opts.entity === "campaign"
        ? "campaign.status = 'ENABLED'"
        : opts.entity === "ad_group"
          ? "ad_group.status = 'ENABLED'"
          : "ad_group_ad.status = 'ENABLED'";
    parts.push(`AND ${statusField}`);
  }

  const orderField =
    opts.entity === "keyword"
      ? "ad_group_criterion.criterion_id"
      : opts.entity === "campaign"
        ? "campaign.id"
        : opts.entity === "ad_group"
          ? "ad_group.id"
          : "ad_group_ad.ad.id";
  parts.push(`ORDER BY ${orderField} ASC`);
  parts.push("LIMIT 10000");
  return parts.join("\n");
}

export function mergeConversionActionMetricsIntoRows(
  entity: MetricEntity,
  baseRows: NormalizedMetricsRow[],
  segmentRows: NormalizedMetricsRow[],
  customKeys: string[],
  metricsCustomerId: string,
  clientLabel?: string,
): NormalizedMetricsRow[] {
  const wanted = new Set(customKeys);
  if (wanted.size === 0) return baseRows;

  const map = new Map<string, NormalizedMetricsRow>();
  for (const row of baseRows) {
    const key = entityResourceKey(entity, row);
    if (key) map.set(key, row);
  }

  for (const segRow of segmentRows) {
    const actionId = String(segRow.identity.conversion_action_id ?? "");
    const metricKey = conversionActionMetricKey(metricsCustomerId, actionId);
    if (!metricKey || !wanted.has(metricKey)) continue;

    const targetKey = entityResourceKey(entity, segRow);
    const target = map.get(targetKey);
    if (!target) continue;
    const val = segRow.metrics.__conv_action_value;
    target.metrics[metricKey] = val != null ? pickNum(val) : null;
  }

  return [...map.values()];
}

/** Normalize GAQL rows segmented by conversion_action into sparse metric rows. */
export function normalizeConversionActionSegmentRows(
  entity: MetricEntity,
  rawRows: Record<string, unknown>[],
  metricsCustomerId: string,
  clientLabel?: string,
): NormalizedMetricsRow[] {
  const out: NormalizedMetricsRow[] = [];
  for (const raw of rawRows) {
    const actionId = conversionActionIdFromSegment(raw);
    if (!actionId) continue;
    const base = normalizeGaqlRow(entity, raw, []);
    const metricsRaw = (raw.metrics ?? {}) as Record<string, unknown>;
    const conversions = pickNum(metricsRaw.conversions);
    base.identity.conversion_action_id = actionId;
    base.metrics.__conv_action_value = conversions;
    if (clientLabel) {
      const resourceId =
        entity === "keyword"
          ? String(base.identity.criterion_id ?? base.id)
          : parseGoogleAdsResourceId(base.id);
      base.identity.client_account = clientLabel;
      base.id = `${metricsCustomerId}-${resourceId}`;
    }
    out.push(base);
  }
  return mergeMetricsRowsByEntity(entity, out);
}

export function customKeysForCustomer(customKeys: string[], customerId: string): string[] {
  const cid = digitsOnly(customerId, 10);
  return customKeys.filter((k) => {
    const parsed = parseConversionActionMetricKey(k);
    return parsed?.customerId === cid;
  });
}
