import type { GoogleAdsConfig } from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";
import { fetchAllGaqlListRows } from "./googleAdsGaql.ts";
import { parseGoogleAdsResourceId } from "./googleAdsMetricsCatalog.ts";
import type { NormalizedMetricsRowLike } from "./googleAdsCampaignServices.ts";
import { monthPeriodKey } from "./monthlyReportAttribution.ts";

export type ReportByServiceAggregate = {
  service_id: string | null;
  service_name: string;
  amount: number;
  impressions: number;
  clicks: number;
  converted_leads: number | null;
  cost_per_lead: number | null;
};

const UNMAPPED_KEY = "__unmapped__";

function readMicros(raw: Record<string, unknown> | undefined, key: string): number {
  const metrics = (raw?.metrics ?? raw?.Metrics) as Record<string, unknown> | undefined;
  const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  const v = Number(metrics?.[camel] ?? metrics?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export async function fetchCampaignMetricsForReport(
  cfg: GoogleAdsConfig,
  accessToken: string,
  metricsCustomerId: string,
  dateStart: string,
  dateEnd: string,
): Promise<{
  rows: NormalizedMetricsRowLike[];
  currencyCode: string | null;
}> {
  const query = [
    "SELECT campaign.id, campaign.name,",
    "metrics.cost_micros, metrics.impressions, metrics.clicks,",
    "customer.currency_code",
    `FROM campaign WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'`,
  ].join(" ");

  const rawRows = await fetchAllGaqlListRows(cfg, accessToken, metricsCustomerId, query);
  const byCampaign = new Map<string, NormalizedMetricsRowLike>();
  let currencyCode: string | null = null;

  for (const raw of rawRows) {
    const campaign = (raw.campaign ?? raw.Campaign) as Record<string, unknown> | undefined;
    const campaignId = parseGoogleAdsResourceId(String(campaign?.id ?? ""));
    if (!campaignId) continue;

    const name = String(campaign?.name ?? "").trim();
    let row = byCampaign.get(campaignId);
    if (!row) {
      row = {
        id: `${metricsCustomerId}-${campaignId}`,
        identity: { name, campaign_id: campaignId },
        metrics: { spent: 0, impressions: 0, clicks: 0 },
      };
      byCampaign.set(campaignId, row);
    }

    row.metrics.spent = (row.metrics.spent ?? 0) + readMicros(raw, "cost_micros") / 1_000_000;
    row.metrics.impressions = (row.metrics.impressions ?? 0) + readMicros(raw, "impressions");
    row.metrics.clicks = (row.metrics.clicks ?? 0) + readMicros(raw, "clicks");

    if (!currencyCode) {
      const customer = (raw.customer ?? raw.Customer) as Record<string, unknown> | undefined;
      const cur = String(customer?.currencyCode ?? customer?.currency_code ?? "").trim();
      if (cur) currencyCode = cur;
    }
  }

  return { rows: [...byCampaign.values()], currencyCode };
}

export function aggregateRowsByService(
  rows: NormalizedMetricsRowLike[],
  unmappedLabel: string,
): ReportByServiceAggregate[] {
  const buckets = new Map<string, ReportByServiceAggregate>();

  for (const row of rows) {
    const serviceId = String(row.identity.service_id ?? "").trim();
    const key = serviceId || UNMAPPED_KEY;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        service_id: serviceId || null,
        service_name: serviceId
          ? String(row.identity.service_name ?? "").trim() || serviceId
          : unmappedLabel,
        amount: 0,
        impressions: 0,
        clicks: 0,
        converted_leads: serviceId ? 0 : null,
        cost_per_lead: null,
      };
      buckets.set(key, bucket);
    }

    bucket.amount += Number(row.metrics.spent ?? 0);
    bucket.impressions += Number(row.metrics.impressions ?? 0);
    bucket.clicks += Number(row.metrics.clicks ?? 0);

    if (serviceId) {
      const cl = Number(row.identity.service_converted_leads ?? 0);
      if (Number.isFinite(cl)) bucket.converted_leads = (bucket.converted_leads ?? 0) + cl;
    }
  }

  const result = [...buckets.values()];
  for (const bucket of result) {
    if (bucket.service_id && bucket.converted_leads != null && bucket.converted_leads > 0) {
      bucket.cost_per_lead = bucket.amount / bucket.converted_leads;
    }
    if (!bucket.service_id && bucket.amount > 0 && bucket.converted_leads == null) {
      bucket.converted_leads = 0;
    }
  }

  return result.sort((a, b) => b.amount - a.amount);
}

/** Single GAQL pass: spend grouped by calendar month (replaces per-month loops). */
export async function fetchCampaignSpendByMonthInRange(
  cfg: GoogleAdsConfig,
  accessToken: string,
  metricsCustomerId: string,
  start: string,
  end: string,
  allowedCampaignIds?: Set<string> | null,
): Promise<{ spendByPeriod: Map<string, number>; currencyCode: string | null }> {
  if (allowedCampaignIds && allowedCampaignIds.size === 0) {
    return { spendByPeriod: new Map(), currencyCode: null };
  }

  const filterByCampaign = allowedCampaignIds != null;
  const query = filterByCampaign
    ? `SELECT campaign.id, segments.month, segments.year, metrics.cost_micros, customer.currency_code FROM campaign WHERE segments.date BETWEEN '${start}' AND '${end}'`
    : `SELECT segments.month, segments.year, metrics.cost_micros, customer.currency_code FROM campaign WHERE segments.date BETWEEN '${start}' AND '${end}'`;

  const rawRows = await fetchAllGaqlListRows(cfg, accessToken, metricsCustomerId, query);
  const spendByPeriod = new Map<string, number>();
  let currencyCode: string | null = null;

  for (const raw of rawRows) {
    if (filterByCampaign && allowedCampaignIds) {
      const campaign = (raw.campaign ?? raw.Campaign) as Record<string, unknown> | undefined;
      const campaignId = parseGoogleAdsResourceId(String(campaign?.id ?? ""));
      if (!campaignId || !allowedCampaignIds.has(campaignId)) continue;
    }

    const segments = (raw.segments ?? raw.Segments) as Record<string, unknown> | undefined;
    const month = Number(segments?.month ?? segments?.Month ?? 0);
    const year = Number(segments?.year ?? segments?.Year ?? 0);
    if (!month || !year) continue;

    const periodKey = monthPeriodKey(year, month);
    const micros = readMicros(raw, "cost_micros");
    spendByPeriod.set(periodKey, (spendByPeriod.get(periodKey) ?? 0) + micros / 1_000_000);

    if (!currencyCode) {
      const customer = (raw.customer ?? raw.Customer) as Record<string, unknown> | undefined;
      const cur = String(customer?.currencyCode ?? customer?.currency_code ?? "").trim();
      if (cur) currencyCode = cur;
    }
  }

  return { spendByPeriod, currencyCode };
}
