import type { MonthlyChartChannelFilter } from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";
import { serviceDataKeyForChart } from "@/6-0-digital-marketing-shared/reportMonthlySpendByService";

/** Product CPA is spend ÷ purchases. Service CPA is spend ÷ converted leads. */
export type ReportCpaByServiceChartPoint = {
  dataKey: string;
  serviceLabel: string;
  productCpa: number;
  serviceCpa: number;
  color: string;
};

/** Same fields the report table uses for one product or service row. */
export type ReportCpaServiceRow = {
  serviceId: string | null;
  serviceName: string;
  amount: number;
  convertedLeads: number | null;
  costPerLead: number | null;
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

type CpaBucket = {
  dataKey: string;
  label: string;
  productSpend: number;
  productResults: number;
  serviceSpend: number;
  serviceResults: number;
};

function includeProductChannel(channelFilter: MonthlyChartChannelFilter): boolean {
  return channelFilter === "all" || channelFilter === "by_channel" || channelFilter === "meta";
}

function includeServiceChannel(
  channelFilter: MonthlyChartChannelFilter,
  channel: "google" | "tiktok",
): boolean {
  return channelFilter === "all" || channelFilter === "by_channel" || channelFilter === channel;
}

/**
 * CPA bars from the same service rows as the report table.
 * Meta rows are product CPA (spend ÷ purchases). Google and TikTok rows are service CPA.
 */
export function buildCpaByServiceChartPointsFromReportRows(args: {
  googleRows: ReportCpaServiceRow[];
  metaRows: ReportCpaServiceRow[];
  tiktokRows: ReportCpaServiceRow[];
  channelFilter: MonthlyChartChannelFilter;
  unmappedLabel: string;
}): ReportCpaByServiceChartPoint[] {
  const buckets = new Map<string, CpaBucket>();

  const ensure = (row: ReportCpaServiceRow): CpaBucket => {
    const dataKey = serviceDataKeyForChart(row.serviceId);
    const existing = buckets.get(dataKey);
    if (existing) {
      if (!existing.label && row.serviceName.trim()) existing.label = row.serviceName.trim();
      return existing;
    }
    const created: CpaBucket = {
      dataKey,
      label: row.serviceName.trim() || args.unmappedLabel,
      productSpend: 0,
      productResults: 0,
      serviceSpend: 0,
      serviceResults: 0,
    };
    buckets.set(dataKey, created);
    return created;
  };

  const add = (row: ReportCpaServiceRow, kind: "product" | "service") => {
    const bucket = ensure(row);
    const results = row.convertedLeads != null && Number.isFinite(row.convertedLeads) ? row.convertedLeads : 0;
    const spend = Number.isFinite(row.amount) ? row.amount : 0;
    if (kind === "product") {
      bucket.productSpend += spend;
      bucket.productResults += results;
      return;
    }
    bucket.serviceSpend += spend;
    bucket.serviceResults += results;
  };

  if (includeProductChannel(args.channelFilter)) {
    for (const row of args.metaRows) add(row, "product");
  }
  if (includeServiceChannel(args.channelFilter, "google")) {
    for (const row of args.googleRows) add(row, "service");
  }
  if (includeServiceChannel(args.channelFilter, "tiktok")) {
    for (const row of args.tiktokRows) add(row, "service");
  }

  return [...buckets.values()]
    .map((bucket) => ({
      bucket,
      productCpa:
        bucket.productSpend > 0 && bucket.productResults > 0
          ? bucket.productSpend / bucket.productResults
          : 0,
      serviceCpa:
        bucket.serviceSpend > 0 && bucket.serviceResults > 0
          ? bucket.serviceSpend / bucket.serviceResults
          : 0,
    }))
    .filter((row) => row.productCpa > 0 || row.serviceCpa > 0)
    .sort(
      (a, b) =>
        b.bucket.productSpend +
        b.bucket.serviceSpend -
        (a.bucket.productSpend + a.bucket.serviceSpend),
    )
    .map((row, index) => ({
      dataKey: row.bucket.dataKey,
      serviceLabel: row.bucket.label,
      productCpa: row.productCpa,
      serviceCpa: row.serviceCpa,
      color: SERVICE_CHART_COLORS[index % SERVICE_CHART_COLORS.length]!,
    }));
}
