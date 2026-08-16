import type { TrafficKpiCompareLabelKey } from "@/6-0-traffic/lib/resolvePreviousTrafficDateRange";

export {
  computeKpiCompareDelta as computeTrafficKpiCompareDelta,
  formatCompareDateRange as formatTrafficCompareDateRange,
  type KpiCompareDelta as TrafficKpiCompareDelta,
  type KpiCompareDirection as TrafficKpiCompareDirection,
} from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";

export const TRAFFIC_KPI_COMPARE_LABEL_I18N: Record<TrafficKpiCompareLabelKey, string> = {
  vsYesterday: "digitalMarketing.traffic.kpi.compare.vsYesterday",
  vsPreviousDay: "digitalMarketing.traffic.kpi.compare.vsPreviousDay",
  vsLastWeek: "digitalMarketing.traffic.kpi.compare.vsLastWeek",
  vsPreviousWeek: "digitalMarketing.traffic.kpi.compare.vsPreviousWeek",
  vsLastMonth: "digitalMarketing.traffic.kpi.compare.vsLastMonth",
  vsPreviousMonth: "digitalMarketing.traffic.kpi.compare.vsPreviousMonth",
  vsPreviousPeriod: "digitalMarketing.traffic.kpi.compare.vsPreviousPeriod",
  vsPreviousYear: "digitalMarketing.traffic.kpi.compare.vsPreviousYear",
  vsPreviousQuarter: "digitalMarketing.traffic.kpi.compare.vsPreviousQuarter",
};
