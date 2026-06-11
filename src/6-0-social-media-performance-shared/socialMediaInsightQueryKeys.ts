import type { InsightTargetPeriodKey } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

export const socialMediaInsightQueryKeys = {
  report: (
    organizationId: string | null | undefined,
    dateStart: string,
    dateEnd: string,
  ) => ["social-media-insight-report", organizationId, dateStart, dateEnd] as const,

  targets: (organizationId: string | null | undefined, period: InsightTargetPeriodKey | null) =>
    [
      "social-media-insight-targets",
      organizationId,
      period?.periodType ?? null,
      period?.year ?? null,
      period?.month ?? null,
      period?.quarter ?? null,
    ] as const,

  assignments: (organizationId: string | null | undefined, period: InsightTargetPeriodKey | null) =>
    [
      "social-media-insight-target-assignments",
      organizationId,
      period?.periodType ?? null,
      period?.year ?? null,
      period?.month ?? null,
      period?.quarter ?? null,
    ] as const,

  periodSettings: (organizationId: string | null | undefined, period: InsightTargetPeriodKey | null) =>
    [
      "social-media-insight-target-period-settings",
      organizationId,
      period?.periodType ?? null,
      period?.year ?? null,
      period?.month ?? null,
      period?.quarter ?? null,
    ] as const,

  linkedIndividualObjectiveIds: (organizationId: string | null | undefined) =>
    ["social-media-insight-linked-io-ids", organizationId] as const,

  insightMetricsByObjective: (organizationId: string | null | undefined) =>
    ["social-media-insight-metrics-by-objective", organizationId] as const,

  periodActuals: (
    organizationId: string | null | undefined,
    period: InsightTargetPeriodKey | null,
    dateStart: string,
    dateEnd: string,
  ) =>
    [
      "social-media-insight-period-actuals",
      organizationId,
      period?.periodType ?? null,
      period?.year ?? null,
      period?.month ?? null,
      period?.quarter ?? null,
      dateStart,
      dateEnd,
    ] as const,

  weeklyCheckinActuals: (
    organizationId: string | null | undefined,
    objectiveId: string | null | undefined,
    weekKeys: string,
  ) =>
    ["social-media-insight-weekly-checkin-actuals", organizationId, objectiveId, weekKeys] as const,
};
