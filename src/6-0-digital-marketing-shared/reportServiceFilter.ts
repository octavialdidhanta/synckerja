import { REPORT_UNMAPPED_SERVICE_KEY } from "@/google-ads/metrics/aggregateCampaignMetricsByService";
import type { ChannelPeriodSummary } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";

/** Empty string = all services (charts + table). */
export type ReportServiceFilterValue = "" | typeof REPORT_UNMAPPED_SERVICE_KEY | string;

export type ReportServiceFilterOption = {
  value: ReportServiceFilterValue;
  label: string;
};

export function buildReportServiceFilterOptions(
  rows: { serviceId: string | null; serviceName: string }[],
  labels: { all: string; unmapped: string },
): ReportServiceFilterOption[] {
  const byId = new Map<string, string>();
  let hasUnmapped = false;

  for (const row of rows) {
    if (row.serviceId == null) {
      hasUnmapped = true;
      continue;
    }
    if (!byId.has(row.serviceId)) {
      byId.set(row.serviceId, row.serviceName);
    }
  }

  const options: ReportServiceFilterOption[] = [{ value: "", label: labels.all }];
  for (const [id, name] of [...byId.entries()].sort((a, b) =>
    a[1].localeCompare(b[1], undefined, { sensitivity: "base" }),
  )) {
    options.push({ value: id, label: name });
  }
  if (hasUnmapped) {
    options.push({ value: REPORT_UNMAPPED_SERVICE_KEY, label: labels.unmapped });
  }
  return options;
}

export function reportRowMatchesServiceFilter(
  row: { serviceId: string | null },
  filter: ReportServiceFilterValue,
): boolean {
  if (!filter) return true;
  if (filter === REPORT_UNMAPPED_SERVICE_KEY) return row.serviceId == null;
  return row.serviceId === filter;
}

export function serviceFilterForApi(
  filter: ReportServiceFilterValue,
): string | undefined {
  if (!filter) return undefined;
  return filter;
}

/** When a service filter is active, align table Cost / Conv. leads / CPA with chart API totals. */
export function alignServiceRowWithChartPeriod<
  T extends {
    amount: number;
    convertedLeads: number | null;
    costPerLead: number | null;
  },
>(row: T, periodSummary: ChannelPeriodSummary | null, useChartTotals: boolean): T {
  if (!useChartTotals || !periodSummary) return row;
  return {
    ...row,
    amount: periodSummary.spend,
    convertedLeads: periodSummary.converted_leads,
    costPerLead: periodSummary.cpa,
  };
}

export function serviceFilterLabel(
  options: ReportServiceFilterOption[],
  filter: ReportServiceFilterValue,
): string | null {
  if (!filter) return null;
  return options.find((o) => o.value === filter)?.label ?? null;
}

/** Which channels contribute to "All channels" combined monthly bars. */
export type ReportCombinedChannelScope = {
  includeGoogle: boolean;
  includeMeta: boolean;
  includeTikTok: boolean;
};

export function buildReportCombinedChannelScope(args: {
  serviceFilterActive: boolean;
  hasGoogleServiceRow: boolean;
  hasMetaServiceRow: boolean;
  hasTikTokServiceRow: boolean;
  googleConnected: boolean;
  metaConnected: boolean;
  tiktokConnected: boolean;
}): ReportCombinedChannelScope {
  if (!args.serviceFilterActive) {
    return {
      includeGoogle: args.googleConnected,
      includeMeta: args.metaConnected,
      includeTikTok: args.tiktokConnected,
    };
  }
  return {
    includeGoogle: args.hasGoogleServiceRow,
    includeMeta: args.hasMetaServiceRow,
    includeTikTok: args.hasTikTokServiceRow,
  };
}

export function combineMonthlyGoogleMeta(
  googleValue: number,
  metaValue: number,
  tiktokValue: number,
  scope: ReportCombinedChannelScope,
): number {
  return (
    (scope.includeGoogle ? googleValue : 0) +
    (scope.includeMeta ? metaValue : 0) +
    (scope.includeTikTok ? tiktokValue : 0)
  );
}
