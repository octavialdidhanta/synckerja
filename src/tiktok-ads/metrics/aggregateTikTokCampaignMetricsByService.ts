import { clampTikTokAdsDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import type {
  TikTokAdsMetricsResponse,
  TikTokAdsMetricsRow,
} from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import { supabase } from "@/shared/lib/supabaseClient";

export const TIKTOK_REPORT_UNMAPPED_SERVICE_KEY = "__unmapped__";

export type TikTokCampaignServiceAggregate = {
  serviceId: string | null;
  serviceName: string;
  amount: number;
  impressions: number;
  clicks: number;
  convertedLeads: number | null;
  costPerLead: number | null;
};

function readMetric(row: TikTokAdsMetricsRow, key: string): number {
  const r = row as Record<string, unknown>;
  const v = r[key];
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function readServiceNumber(raw: unknown): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  return Number(raw);
}

function normalizeReportCurrency(code: string | null | undefined): string | null {
  const c = String(code ?? "").trim().toUpperCase();
  return c || null;
}

/**
 * Aggregate TikTok campaign rows into per-service buckets (+ unmapped).
 */
export function aggregateTikTokCampaignMetricsByService(
  rows: TikTokAdsMetricsRow[],
  unmappedLabel: string,
): TikTokCampaignServiceAggregate[] {
  const buckets = new Map<string, TikTokCampaignServiceAggregate>();

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const serviceId = String(r.service_id ?? "").trim();
    const bucketKey = serviceId || TIKTOK_REPORT_UNMAPPED_SERVICE_KEY;

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

export type TikTokReportByServiceApiRow = {
  service_id: string | null;
  service_name: string;
  amount: number;
  impressions: number;
  clicks: number;
  converted_leads: number | null;
  cost_per_lead: number | null;
};

export function mapTikTokReportByServiceApiRows(
  rows: TikTokReportByServiceApiRow[] | undefined,
): TikTokCampaignServiceAggregate[] {
  return (rows ?? []).map((r) => ({
    serviceId: r.service_id,
    serviceName: r.service_name,
    amount: r.amount,
    impressions: r.impressions,
    clicks: r.clicks,
    convertedLeads: r.converted_leads,
    costPerLead: r.cost_per_lead,
  }));
}

const MAX_CAMPAIGN_PAGES = 100;

export async function fetchTikTokAdsMetricsPage(
  organizationId: string,
  advertiserId: string,
  dateStart: string,
  dateEnd: string,
  pageToken: string,
): Promise<TikTokAdsMetricsResponse> {
  const { start, end } = clampTikTokAdsDateRange(dateStart, dateEnd);
  const { data, error } = await supabase.functions.invoke("tiktok-ads-metrics", {
    body: {
      organization_id: organizationId,
      advertiser_id: advertiserId,
      entity: "campaign",
      date_start: start,
      date_end: end,
      page_token: pageToken,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokAdsMetricsResponse & { error?: string };
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

export async function fetchAllTikTokAdsCampaignRows(
  organizationId: string,
  filters: {
    advertiserId: string;
    dateStart: string;
    dateEnd: string;
  },
): Promise<{ rows: TikTokAdsMetricsRow[]; currencyCode: string | null }> {
  const allRows: TikTokAdsMetricsRow[] = [];
  let pageToken = "";
  let currencyCode: string | null = null;

  for (let page = 0; page < MAX_CAMPAIGN_PAGES; page++) {
    const response = await fetchTikTokAdsMetricsPage(
      organizationId,
      filters.advertiserId,
      filters.dateStart,
      filters.dateEnd,
      pageToken,
    );

    if (!currencyCode && response.summary?.currency) {
      currencyCode = normalizeReportCurrency(response.summary.currency);
    }

    allRows.push(...(response.rows ?? []));

    const nextToken = response.next_page_token;
    if (nextToken == null || nextToken === "") break;

    if (nextToken === pageToken) break;
    pageToken = nextToken;
  }

  return {
    rows: allRows,
    currencyCode: currencyCode ? normalizeReportCurrency(currencyCode) : null,
  };
}
