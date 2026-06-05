import type { MonthlySpendBucket, ReportChartSpanMode } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import type { ReportGoogleServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import type { ReportMetaServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import type { MonthlyChartChannelFilter } from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";
import {
  buildReportServiceSpendSeriesList,
  serviceDataKeyForChart,
  type ReportServiceSpendSeries,
} from "@/6-0-digital-marketing-shared/reportMonthlySpendByService";
import { REPORT_UNMAPPED_SERVICE_KEY } from "@/google-ads/metrics/aggregateCampaignMetricsByService";

export type ReportServiceLeadsSeries = ReportServiceSpendSeries & {
  totalLeads: number;
};

/** One bar per service — total converted leads for the selected date range. */
export type ReportLeadsByServiceChartPoint = {
  dataKey: string;
  serviceLabel: string;
  leads: number;
  color: string;
};

function monthLookupKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function buildReportServiceLeadsSeriesList(
  googleRows: ReportGoogleServiceRow[],
  metaRows: ReportMetaServiceRow[],
  unmappedLabel: string,
): ReportServiceLeadsSeries[] {
  const spendSeries = buildReportServiceSpendSeriesList(googleRows, metaRows, unmappedLabel);
  const leadTotals = new Map<string, number>();

  const add = (serviceId: string | null, leads: number | null) => {
    const key = serviceId ?? REPORT_UNMAPPED_SERVICE_KEY;
    const n = leads != null && Number.isFinite(leads) ? leads : 0;
    leadTotals.set(key, (leadTotals.get(key) ?? 0) + n);
  };

  for (const r of googleRows) add(r.serviceId, r.convertedLeads);
  for (const r of metaRows) add(r.serviceId, r.convertedLeads);

  return spendSeries
    .map((svc) => {
      const key = svc.serviceId ?? REPORT_UNMAPPED_SERVICE_KEY;
      return {
        ...svc,
        dataKey: serviceDataKeyForChart(svc.serviceId),
        totalLeads: leadTotals.get(key) ?? 0,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);
}

export function aggregateServiceLeadsByCalendarMonth(
  rows: MonthlySpendBucket[],
): MonthlySpendBucket[] {
  const sums = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    spend: 0,
    converted_leads: 0,
  }));
  for (const r of rows) {
    if (r.month < 1 || r.month > 12) continue;
    const slot = sums[r.month - 1]!;
    slot.converted_leads += Number.isFinite(r.converted_leads) ? r.converted_leads! : 0;
  }
  return sums.map((b) => ({
    month: b.month,
    spend: 0,
    converted_leads: b.converted_leads,
  }));
}

export function sumMonthlyLeadsForChannelFilter(
  google: MonthlySpendBucket[],
  meta: MonthlySpendBucket[],
  fallbackYear: number,
  channelFilter: MonthlyChartChannelFilter,
  spanMode: ReportChartSpanMode = "calendar_year",
): Map<string, number> {
  const out = new Map<string, number>();
  const addRows = (rows: MonthlySpendBucket[]) => {
    for (const r of rows) {
      const key =
        spanMode === "all_time"
          ? String(r.month)
          : monthLookupKey(r.year ?? fallbackYear, r.month);
      const leads = Number.isFinite(r.converted_leads) ? r.converted_leads! : 0;
      out.set(key, (out.get(key) ?? 0) + leads);
    }
  };
  if (channelFilter === "google") addRows(google);
  else if (channelFilter === "meta") addRows(meta);
  else {
    addRows(google);
    addRows(meta);
  }
  return out;
}

export function buildLeadsByServiceTotalsChartPoints(
  services: ReportServiceLeadsSeries[],
  leadsByServiceKey: Map<string, Map<string, number>>,
): ReportLeadsByServiceChartPoint[] {
  return services
    .map((svc) => {
      const periodMap = leadsByServiceKey.get(svc.dataKey);
      let leads = 0;
      if (periodMap) {
        for (const value of periodMap.values()) {
          leads += value;
        }
      }
      return {
        dataKey: svc.dataKey,
        serviceLabel: svc.label,
        leads,
        color: svc.color,
      };
    })
    .filter((row) => row.leads > 0)
    .sort((a, b) => b.leads - a.leads);
}
