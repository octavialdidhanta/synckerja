import {
  fetchGoogleAdsMetrics,
  type GoogleAdsMetricsFilters,
} from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import type { GoogleAdsMetricsRow, GoogleAdsMetricsResponse } from "@/google-ads/metrics/types";

export const REPORT_UNMAPPED_SERVICE_KEY = "__unmapped__";

export type CampaignServiceAggregate = {
  serviceId: string | null;
  serviceName: string;
  amount: number;
  impressions: number;
  clicks: number;
  convertedLeads: number | null;
  costPerLead: number | null;
};

function readMetric(row: GoogleAdsMetricsRow, key: string): number {
  const v = row.metrics[key];
  if (v == null || !Number.isFinite(v)) return 0;
  return v;
}

function readIdentityNumber(raw: unknown): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  return Number(raw);
}

/**
 * Aggregate campaign metrics rows into per-service buckets (+ unmapped).
 * Conv. leads are summed from per-campaign UTM attribution on each row.
 */
export function aggregateCampaignMetricsByService(
  rows: GoogleAdsMetricsRow[],
  unmappedLabel: string,
): CampaignServiceAggregate[] {
  const buckets = new Map<string, CampaignServiceAggregate>();

  for (const row of rows) {
    const serviceId = String(row.identity.service_id ?? "").trim();
    const bucketKey = serviceId || REPORT_UNMAPPED_SERVICE_KEY;

    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        serviceId: serviceId || null,
        serviceName: serviceId
          ? String(row.identity.service_name ?? "").trim() || serviceId
          : unmappedLabel,
        amount: 0,
        impressions: 0,
        clicks: 0,
        convertedLeads: serviceId ? 0 : null,
        costPerLead: null,
      };
      buckets.set(bucketKey, bucket);
    }

    bucket.amount += readMetric(row, "spent");
    bucket.impressions += readMetric(row, "impressions");
    bucket.clicks += readMetric(row, "clicks");

    if (serviceId) {
      const cl = readIdentityNumber(row.identity.service_converted_leads);
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
const REPORT_CAMPAIGN_PAGE_SIZE = 100;

export async function fetchAllGoogleAdsCampaignRows(
  organizationId: string,
  filters: {
    customerId: string;
    dateRange: { preset?: string; start?: string; end?: string };
    onlyRunning: boolean;
    statusFilter: "all" | "enabled_only";
  },
  fetchPage: (
    organizationId: string,
    pageFilters: GoogleAdsMetricsFilters,
  ) => Promise<GoogleAdsMetricsResponse> = fetchGoogleAdsMetrics,
): Promise<{ rows: GoogleAdsMetricsRow[]; currencyCode: string | null }> {
  const allRows: GoogleAdsMetricsRow[] = [];
  let offset = 0;
  let currencyCode: string | null = null;

  for (let page = 0; page < MAX_CAMPAIGN_PAGES; page++) {
    const response = await fetchPage(organizationId, {
      customerId: filters.customerId,
      entity: "campaign",
      metrics: ["spent", "impressions", "clicks"],
      dateRange: filters.dateRange,
      onlyRunning: filters.onlyRunning,
      statusFilter: filters.statusFilter,
      pageToken: String(offset),
      pageSize: REPORT_CAMPAIGN_PAGE_SIZE,
      sort: { field: "spent", direction: "desc" },
      summaryMetrics: ["spent", "impressions", "clicks"],
    });

    if (!currencyCode && response.currency_code) {
      currencyCode = response.currency_code;
    }

    allRows.push(...(response.rows ?? []));

    const nextToken = response.next_page_token;
    if (nextToken == null || nextToken === "") break;

    const nextOffset = Number(nextToken);
    if (!Number.isFinite(nextOffset) || nextOffset <= offset) break;

    const total = response.total_row_count;
    if (typeof total === "number" && allRows.length >= total) break;

    offset = nextOffset;
  }

  return { rows: allRows, currencyCode };
}
