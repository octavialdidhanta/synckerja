import { REPORT_UNMAPPED_SERVICE_KEY } from "@/google-ads/metrics/aggregateCampaignMetricsByService";
import type {
  MonthlySpendBucket,
  ReportChartSpanMode,
  ReportMonthlySpendChartPoint,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import type { ReportGoogleServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import type { ReportMetaServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import type { MonthlyChartChannelFilter } from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";

export type ReportServiceSpendSeries = {
  dataKey: string;
  serviceId: string | null;
  label: string;
  color: string;
  totalSpend: number;
};

/** One bar per service — total spend for the selected date range. */
export type ReportSpendByServiceChartPoint = {
  dataKey: string;
  serviceLabel: string;
  spend: number;
  color: string;
};

const SERVICE_CHART_COLORS = [
  "hsl(204 70% 42%)",
  "hsl(262 55% 52%)",
  "hsl(160 52% 36%)",
  "hsl(24 75% 48%)",
  "hsl(280 45% 48%)",
  "hsl(340 55% 48%)",
  "hsl(45 85% 42%)",
  "hsl(190 60% 42%)",
];

export function serviceDataKeyForChart(serviceId: string | null): string {
  return serviceId ? `svc_${serviceId.replace(/-/g, "")}` : "svc_unmapped";
}

export function serviceIdForMonthlyApi(serviceId: string | null): string {
  return serviceId ?? REPORT_UNMAPPED_SERVICE_KEY;
}

export function buildReportServiceSpendSeriesList(
  googleRows: ReportGoogleServiceRow[],
  metaRows: ReportMetaServiceRow[],
  unmappedLabel: string,
): ReportServiceSpendSeries[] {
  const totals = new Map<
    string,
    { serviceId: string | null; label: string; totalSpend: number }
  >();

  const add = (serviceId: string | null, name: string, amount: number) => {
    const key = serviceId ?? REPORT_UNMAPPED_SERVICE_KEY;
    const prev = totals.get(key);
    if (prev) {
      prev.totalSpend += amount;
    } else {
      totals.set(key, {
        serviceId,
        label: serviceId ? name : unmappedLabel,
        totalSpend: amount,
      });
    }
  };

  for (const r of googleRows) add(r.serviceId, r.serviceName, r.amount);
  for (const r of metaRows) add(r.serviceId, r.serviceName, r.amount);

  return [...totals.values()]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .map((row, index) => ({
      dataKey: serviceDataKeyForChart(row.serviceId),
      serviceId: row.serviceId,
      label: row.label,
      color: SERVICE_CHART_COLORS[index % SERVICE_CHART_COLORS.length]!,
      totalSpend: row.totalSpend,
    }));
}

function monthLookupKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function periodSpendLookupKey(
  period: Pick<ReportMonthlySpendChartPoint, "year" | "month">,
  spanMode: ReportChartSpanMode,
): string {
  if (spanMode === "all_time") return String(period.month);
  return monthLookupKey(period.year, period.month);
}

/** All time: sum spend per calendar month (Jan–Dec) across years in range. */
export function aggregateServiceSpendByCalendarMonth(
  rows: MonthlySpendBucket[],
): MonthlySpendBucket[] {
  const sums = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    spend: 0,
  }));
  for (const r of rows) {
    if (r.month < 1 || r.month > 12) continue;
    const slot = sums[r.month - 1]!;
    slot.spend += Number.isFinite(r.spend) ? r.spend : 0;
  }
  return sums.map((b) => ({ month: b.month, spend: b.spend }));
}

export function sumMonthlySpendForChannelFilter(
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
      out.set(key, (out.get(key) ?? 0) + (Number.isFinite(r.spend) ? r.spend : 0));
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

export function buildSpendByServiceTotalsChartPoints(
  services: ReportServiceSpendSeries[],
  spendByServiceKey: Map<string, Map<string, number>>,
): ReportSpendByServiceChartPoint[] {
  return services
    .map((svc) => {
      const periodMap = spendByServiceKey.get(svc.dataKey);
      let spend = 0;
      if (periodMap) {
        for (const value of periodMap.values()) {
          spend += value;
        }
      }
      return {
        dataKey: svc.dataKey,
        serviceLabel: svc.label,
        spend,
        color: svc.color,
      };
    })
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend);
}
