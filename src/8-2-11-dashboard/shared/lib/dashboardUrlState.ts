import {
  computeSalesSummaryPresetRange,
} from "@/8-2-10-reports/sales-summary/lib/salesSummaryDatePresets";
import type {
  SalesSummaryDatePresetId,
  SalesSummaryDateRange,
} from "@/8-2-10-reports/sales-summary/lib/salesSummaryTypes";

export type DashboardTab = "summary" | "comparison";

export type DashboardUrlState = {
  tab: DashboardTab;
  outletId: string | null;
  compareOutletIds: string[];
  dateRange: SalesSummaryDateRange;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRESETS = new Set<SalesSummaryDatePresetId>([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "custom",
]);

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function parseDashboardUrlState(searchParams: URLSearchParams): DashboardUrlState {
  const rawPreset = searchParams.get("preset");
  const preset = rawPreset && PRESETS.has(rawPreset as SalesSummaryDatePresetId)
    ? rawPreset as SalesSummaryDatePresetId
    : "today";
  const fallbackRange = computeSalesSummaryPresetRange(preset === "custom" ? "today" : preset);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const outletId = searchParams.get("outletId");
  const compareOutletIds = Array.from(
    new Set((searchParams.get("compareOutletIds") ?? "").split(",").filter(isUuid)),
  ).slice(0, 5);

  return {
    tab: searchParams.get("tab") === "comparison" ? "comparison" : "summary",
    outletId: isUuid(outletId) ? outletId : null,
    compareOutletIds,
    dateRange: {
      preset,
      from: from && YMD_PATTERN.test(from) ? from : fallbackRange.from,
      to: to && YMD_PATTERN.test(to) ? to : fallbackRange.to,
    },
  };
}

export function dashboardStateToSearchParams(state: DashboardUrlState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("tab", state.tab);
  if (state.outletId) params.set("outletId", state.outletId);
  const compareOutletIds = Array.from(
    new Set(state.compareOutletIds.filter(isUuid)),
  ).slice(0, 5);
  if (compareOutletIds.length) {
    params.set("compareOutletIds", compareOutletIds.join(","));
  }
  params.set("preset", state.dateRange.preset);
  params.set("from", state.dateRange.from);
  params.set("to", state.dateRange.to);
  return params;
}
