import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import type { InsightTargetPeriodKey, InsightTargetPeriodType } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

export type DmReportChannel = "google" | "meta" | "tiktok";

export type DmReportTargetPeriodKey = InsightTargetPeriodKey;
export type DmReportTargetPeriodType = InsightTargetPeriodType;

export const DM_REPORT_TARGET_MAX_METRICS = 8;

export const DM_REPORT_METRIC_KEYS: ReportTableMetricKey[] = [
  "cost",
  "cpc",
  "cpa",
  "converted_leads",
  "impressions",
  "ctr",
  "clicks",
];

export type DmReportTargetAccountRef = {
  channel: DmReportChannel;
  accountId: string;
  accountLabel: string;
  currencyCode: string | null;
  sortOrder: number;
};

export type DmReportTargetRow = {
  id: string;
  organization_id: string;
  channel: DmReportChannel;
  account_id: string;
  metric_key: string;
  period_type: DmReportTargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  target_value: number;
  individual_objective_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DmReportTargetPeriodSettingsRow = {
  id: string;
  organization_id: string;
  period_type: DmReportTargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  company_objective_id: string;
  synced_department_objective_id: string | null;
  /** @deprecated Use selected_metrics_by_channel */
  selected_metrics: string[];
  selected_metrics_by_channel: Record<DmReportChannel, string[]>;
  metric_directions: DmReportMetricDirectionsMap;
  created_at: string;
  updated_at: string;
};

export type DmReportTargetAssignmentRow = {
  id: string;
  organization_id: string;
  channel: DmReportChannel;
  account_id: string;
  period_type: DmReportTargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  employee_id: string;
  created_at: string;
  updated_at: string;
};

export type DmReportTargetAccountAssignment = {
  channel: DmReportChannel;
  accountId: string;
  employeeId: string;
};

export type DmReportTargetFormValue = {
  channel: DmReportChannel;
  accountId: string;
  metricKey: string;
  targetValue: number;
};

export type DmReportMetricValueKind = "currency" | "count" | "rate" | "micros";

export type DmReportTargetProgress = {
  metricKey: string;
  actual: number | null;
  target: number | null;
  targetRaw: number | null;
  /** Report summary bar %: Desc = OKR score, Asc = uncapped achievement. */
  percentage: number | null;
  /** OKR-style deviation: 0 = on target, negative = off-track for direction. */
  deviationPercentage: number | null;
  showProgress: boolean;
  valueKind: DmReportMetricValueKind;
};

export type DmAccountPeriodActuals = {
  channel: DmReportChannel;
  accountId: string;
  hasConnectedAccount: boolean;
  metrics: Record<string, number | null>;
  currencyCode: string | null;
};

export function dmTargetCellKey(
  channel: DmReportChannel,
  accountId: string,
  metricKey: string,
): string {
  return `${channel}:${accountId}:${metricKey}`;
}

export function dmTargetAccountKey(channel: DmReportChannel, accountId: string): string {
  return `${channel}:${accountId}`;
}

export function parseDmTargetAccountKey(key: string): { channel: DmReportChannel; accountId: string } | null {
  const parts = key.split(":");
  if (parts.length < 2) return null;
  const channel = parts[0] as DmReportChannel;
  if (channel !== "google" && channel !== "meta" && channel !== "tiktok") return null;
  return { channel, accountId: parts.slice(1).join(":") };
}
