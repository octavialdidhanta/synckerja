import type { DmReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

function periodSegment(period: DmReportTargetPeriodKey | null): string {
  if (!period) return "none";
  if (period.periodType === "monthly") {
    return `m:${period.year}:${period.month ?? 0}`;
  }
  return `q:${period.year}:${period.quarter ?? 0}`;
}

export const dmReportTargetQueryKeys = {
  all: (orgId: string | null | undefined) => ["dm-report-targets", orgId] as const,
  targets: (orgId: string | null | undefined, period: DmReportTargetPeriodKey | null) =>
    [...dmReportTargetQueryKeys.all(orgId), "targets", periodSegment(period)] as const,
  assignments: (orgId: string | null | undefined, period: DmReportTargetPeriodKey | null) =>
    [...dmReportTargetQueryKeys.all(orgId), "assignments", periodSegment(period)] as const,
  periodSettings: (orgId: string | null | undefined, period: DmReportTargetPeriodKey | null) =>
    [...dmReportTargetQueryKeys.all(orgId), "period-settings", periodSegment(period)] as const,
  accounts: (orgId: string | null | undefined) =>
    [...dmReportTargetQueryKeys.all(orgId), "accounts"] as const,
  actuals: (
    orgId: string | null | undefined,
    period: DmReportTargetPeriodKey | null,
    metricKeys: string[],
    accountKeys: string[],
  ) =>
    [
      ...dmReportTargetQueryKeys.all(orgId),
      "actuals",
      periodSegment(period),
      [...metricKeys].sort().join("|"),
      [...accountKeys].sort().join("|"),
    ] as const,
  metricsByObjective: (orgId: string | null | undefined) =>
    [...dmReportTargetQueryKeys.all(orgId), "metrics-by-objective"] as const,
  objectiveProgress: (orgId: string | null | undefined) =>
    [...dmReportTargetQueryKeys.all(orgId), "objective-progress"] as const,
  weeklyCheckinActuals: (
    orgId: string | null | undefined,
    objectiveId: string | undefined,
    weekKeys: string,
  ) =>
    [...dmReportTargetQueryKeys.all(orgId), "weekly-checkin", objectiveId, weekKeys] as const,
};
