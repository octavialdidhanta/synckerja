import { clampMetaAdsDateRange } from "@/meta-ads/lib/clampMetaAdsDateRange";
import { parseEdgeFunctionError } from "@/meta-ads/lib/parseEdgeFunctionError";
import type {
  MetaAdsMetricsResponse,
  MetaAdsMetricsRow,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { normalizeMetaAdsReportCurrency } from "@/meta-ads/lib/metaAdsReportCurrency";
import { supabase } from "@/shared/lib/supabaseClient";

export const META_REPORT_UNMAPPED_SERVICE_KEY = "__unmapped__";

export type MetaCampaignServiceAggregate = {
  serviceId: string | null;
  serviceName: string;
  amount: number;
  impressions: number;
  clicks: number;
  convertedLeads: number | null;
  costPerLead: number | null;
};

function readMetric(row: MetaAdsMetricsRow, key: string): number {
  const r = row as Record<string, unknown>;
  const v = r[key];
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function readServiceNumber(raw: unknown): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  return Number(raw);
}

/**
 * Aggregate Meta campaign rows into per-service buckets (+ unmapped).
 */
export function aggregateMetaCampaignMetricsByService(
  rows: MetaAdsMetricsRow[],
  unmappedLabel: string,
): MetaCampaignServiceAggregate[] {
  const buckets = new Map<string, MetaCampaignServiceAggregate>();

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const serviceId = String(r.service_id ?? "").trim();
    const bucketKey = serviceId || META_REPORT_UNMAPPED_SERVICE_KEY;

    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        serviceId: serviceId || null,
        serviceName: serviceId
          ? String(r.service_name ?? "").trim() || serviceId
          : unmappedLabel,
        amount: 0,
        impressions: 0,
        clicks: 0,
        convertedLeads: serviceId ? 0 : null,
        costPerLead: null,
      };
      buckets.set(bucketKey, bucket);
    }

    bucket.amount += readMetric(row, "spend");
    bucket.impressions += readMetric(row, "impressions");
    bucket.clicks += readMetric(row, "clicks");

    if (serviceId) {
      const cl = readServiceNumber(r.service_converted_leads);
      if (cl != null) bucket.convertedLeads = (bucket.convertedLeads ?? 0) + cl;
    }
  }

  const result = [...buckets.values()];

  for (const bucket of result) {
    if (bucket.serviceId && bucket.convertedLeads != null && bucket.convertedLeads > 0) {
      bucket.costPerLead = bucket.amount / bucket.convertedLeads;
    }
    if (!bucket.serviceId && bucket.amount > 0 && bucket.convertedLeads == null) {
      bucket.convertedLeads = 0;
      bucket.costPerLead = null;
    }
  }

  return result.sort((a, b) => b.amount - a.amount);
}

const MAX_CAMPAIGN_PAGES = 100;

export async function fetchMetaAdsMetricsPage(
  organizationId: string,
  adAccountId: string,
  dateStart: string,
  dateEnd: string,
  pageToken: string,
): Promise<MetaAdsMetricsResponse> {
  const { start, end } = clampMetaAdsDateRange(dateStart, dateEnd);
  const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
    body: {
      organization_id: organizationId,
      ad_account_id: adAccountId,
      entity: "campaign",
      date_start: start,
      date_end: end,
      page_token: pageToken,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as MetaAdsMetricsResponse & { error?: string };
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

export async function fetchAllMetaAdsCampaignRows(
  organizationId: string,
  filters: {
    adAccountId: string;
    dateStart: string;
    dateEnd: string;
  },
): Promise<{ rows: MetaAdsMetricsRow[]; currencyCode: string | null }> {
  const allRows: MetaAdsMetricsRow[] = [];
  let pageToken = "";
  let currencyCode: string | null = null;

  for (let page = 0; page < MAX_CAMPAIGN_PAGES; page++) {
    const response = await fetchMetaAdsMetricsPage(
      organizationId,
      filters.adAccountId,
      filters.dateStart,
      filters.dateEnd,
      pageToken,
    );

    if (!currencyCode && response.summary?.currency) {
      currencyCode = normalizeMetaAdsReportCurrency(response.summary.currency);
    }

    allRows.push(...(response.rows ?? []));

    const nextToken = response.next_page_token;
    if (nextToken == null || nextToken === "") break;

    if (nextToken === pageToken) break;
    pageToken = nextToken;
  }

  return {
    rows: allRows,
    currencyCode: currencyCode ? normalizeMetaAdsReportCurrency(currencyCode) : null,
  };
}
