import type { SocialMediaPlatform } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

export type InsightTargetMetric =
  | "audience"
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "avg_engagement_rate";

export type InsightTargetPeriodType = "monthly" | "quarterly";

export type InsightTargetPlatform = SocialMediaPlatform;

export const INSIGHT_TARGET_METRICS: InsightTargetMetric[] = [
  "audience",
  "views",
  "likes",
  "comments",
  "shares",
  "avg_engagement_rate",
];

export const INSIGHT_TARGET_PLATFORMS: InsightTargetPlatform[] = [
  "tiktok",
  "youtube",
  "linkedin",
];

export type InsightTargetAccountRef = {
  platform: InsightTargetPlatform;
  accountId: string;
  accountLabel: string;
  avatarUrl: string | null;
};

export type SocialMediaInsightTargetRow = {
  id: string;
  organization_id: string;
  platform: InsightTargetPlatform;
  account_id: string;
  metric: InsightTargetMetric;
  period_type: InsightTargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  target_value: number;
  individual_objective_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialMediaInsightTargetPeriodSettingsRow = {
  id: string;
  organization_id: string;
  period_type: InsightTargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  company_objective_id: string;
  synced_department_objective_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialMediaInsightTargetAssignmentRow = {
  id: string;
  organization_id: string;
  platform: InsightTargetPlatform;
  account_id: string;
  period_type: InsightTargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  employee_id: string;
  individual_objective_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InsightTargetAccountAssignment = {
  platform: InsightTargetPlatform;
  accountId: string;
  employeeId: string;
};

export type InsightTargetPeriodKey = {
  periodType: InsightTargetPeriodType;
  year: number;
  month?: number;
  quarter?: number;
};

export type InsightTargetProgress = {
  metric: InsightTargetMetric;
  actual: number | null;
  /** Effective target after prorate (volume metrics only). */
  target: number | null;
  /** Raw target from DB before prorate. */
  targetRaw: number | null;
  percentage: number | null;
  showProgress: boolean;
};

export type InsightTargetFormValue = {
  platform: InsightTargetPlatform;
  accountId: string;
  metric: InsightTargetMetric;
  targetValue: number;
};

export function insightTargetCellKey(
  platform: InsightTargetPlatform,
  accountId: string,
  metric: InsightTargetMetric,
): string {
  return `${platform}:${accountId}:${metric}`;
}

export function insightTargetAccountKey(
  platform: InsightTargetPlatform,
  accountId: string,
): string {
  return `${platform}:${accountId}`;
}
