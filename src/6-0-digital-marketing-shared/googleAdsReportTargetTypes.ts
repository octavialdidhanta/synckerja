import type { MetricValueKind } from "@/google-ads/metrics/types";
import type { InsightTargetPeriodKey, InsightTargetPeriodType } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

export type GoogleAdsReportTargetPeriodKey = InsightTargetPeriodKey;
export type GoogleAdsReportTargetPeriodType = InsightTargetPeriodType;

export const GOOGLE_ADS_REPORT_TARGET_MAX_METRICS = 8;

export type GoogleAdsReportTargetAccountRef = {
  customerId: string;
  accountLabel: string;
  currencyCode: string | null;
};

export type GoogleAdsReportTargetRow = {
  id: string;
  organization_id: string;
  google_customer_id: string;
  metric_key: string;
  period_type: GoogleAdsReportTargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  target_value: number;
  individual_objective_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GoogleAdsReportTargetPeriodSettingsRow = {
  id: string;
  organization_id: string;
  period_type: GoogleAdsReportTargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  company_objective_id: string;
  synced_department_objective_id: string | null;
  selected_metrics: string[];
  created_at: string;
  updated_at: string;
};

export type GoogleAdsReportTargetAssignmentRow = {
  id: string;
  organization_id: string;
  google_customer_id: string;
  period_type: GoogleAdsReportTargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  employee_id: string;
  created_at: string;
  updated_at: string;
};

export type GoogleAdsReportTargetAccountAssignment = {
  customerId: string;
  employeeId: string;
};

export type GoogleAdsReportTargetFormValue = {
  customerId: string;
  metricKey: string;
  targetValue: number;
};

export type GoogleAdsReportTargetProgress = {
  metricKey: string;
  actual: number | null;
  target: number | null;
  targetRaw: number | null;
  percentage: number | null;
  showProgress: boolean;
  valueKind: MetricValueKind;
};

export type GoogleAdsAccountPeriodActuals = {
  customerId: string;
  hasConnectedAccount: boolean;
  metrics: Record<string, number | null>;
  valueKinds: Record<string, MetricValueKind>;
};

export function googleAdsTargetCellKey(customerId: string, metricKey: string): string {
  return `${customerId}:${metricKey}`;
}

export function googleAdsTargetAccountKey(customerId: string): string {
  return customerId;
}
