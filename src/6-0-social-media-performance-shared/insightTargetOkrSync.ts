import {
  buildInsightObjectiveTitle,
  resolveOkrCycleForInsightPeriod,
} from "@/6-0-social-media-performance-shared/insightTargetOkrCycleResolver";
import { insightKeyResultProgress } from "@/6-0-social-media-performance-shared/insightTargetOkrProgress";
import { buildInsightMetricObjectiveTitle } from "@/6-0-social-media-performance-shared/insightTargetMetricObjectiveTitle";
import { periodKeyToQueryFilter } from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import {
  actualValueForMetric,
  type PlatformPeriodActuals,
} from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import type {
  InsightTargetAccountRef,
  InsightTargetPeriodKey,
  SocialMediaInsightTargetAssignmentRow,
  SocialMediaInsightTargetRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InsightOkrSyncResult = {
  syncedIndividualObjectiveCount: number;
  skippedNoCycle: boolean;
  cycleId: string | null;
  syncedDepartmentObjectiveId: string | null;
};

type AccountActualsMap = Map<string, PlatformPeriodActuals>;

function accountActualsKey(platform: string, accountId: string): string {
  return `${platform}:${accountId}`;
}

async function deleteIndividualObjective(
  supabase: SupabaseClient,
  objectiveId: string,
): Promise<void> {
  const { error } = await supabase.from("individual_objectives").delete().eq("id", objectiveId);
  if (error) throw error;
}

async function cleanupLegacyInsightSyncForPeriod(args: {
  supabase: SupabaseClient;
  organizationId: string;
  period: InsightTargetPeriodKey;
  cycleId: string;
}): Promise<void> {
  const filter = periodKeyToQueryFilter(args.period);
  const legacyIoTitle = buildInsightObjectiveTitle(args.period);

  let targetsQuery = args.supabase
    .from("social_media_insight_targets")
    .select("id, individual_objective_id")
    .eq("organization_id", args.organizationId)
    .eq("period_type", filter.period_type)
    .eq("year", filter.year);

  if (filter.period_type === "monthly" && filter.month != null) {
    targetsQuery = targetsQuery.eq("month", filter.month);
  }
  if (filter.period_type === "quarterly" && filter.quarter != null) {
    targetsQuery = targetsQuery.eq("quarter", filter.quarter);
  }

  const { data: targets, error: targetsError } = await targetsQuery;
  if (targetsError) throw targetsError;

  const linkedIoIds = [
    ...new Set(
      (targets ?? [])
        .map((r) => r.individual_objective_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  for (const ioId of linkedIoIds) {
    await deleteIndividualObjective(args.supabase, ioId);
  }

  if (linkedIoIds.length > 0) {
    const { error: clearError } = await args.supabase
      .from("social_media_insight_targets")
      .update({ individual_objective_id: null })
      .in("individual_objective_id", linkedIoIds);
    if (clearError) throw clearError;
  }

  const { data: legacyIos, error: legacyError } = await args.supabase
    .from("individual_objectives")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("cycle_id", args.cycleId)
    .eq("title", legacyIoTitle);

  if (legacyError) throw legacyError;

  for (const row of legacyIos ?? []) {
    await deleteIndividualObjective(args.supabase, row.id as string);
  }
}

async function findOrCreateInsightDepartmentObjective(args: {
  supabase: SupabaseClient;
  organizationId: string;
  cycleId: string;
  companyObjectiveId: string;
  departmentId: string;
  period: InsightTargetPeriodKey;
  createdBy: string;
}): Promise<string> {
  const title = buildInsightObjectiveTitle(args.period);

  const { data: existing, error: findError } = await args.supabase
    .from("department_objectives")
    .select("id, company_objective_id, department_id")
    .eq("organization_id", args.organizationId)
    .eq("cycle_id", args.cycleId)
    .eq("title", title)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const updates: Record<string, string> = {};
    if (existing.company_objective_id !== args.companyObjectiveId) {
      updates.company_objective_id = args.companyObjectiveId;
    }
    if (existing.department_id !== args.departmentId) {
      updates.department_id = args.departmentId;
    }
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await args.supabase
        .from("department_objectives")
        .update(updates)
        .eq("id", existing.id);
      if (updateError) throw updateError;
    }
    return existing.id;
  }

  const { data: created, error: createError } = await args.supabase
    .from("department_objectives")
    .insert({
      organization_id: args.organizationId,
      cycle_id: args.cycleId,
      company_objective_id: args.companyObjectiveId,
      department_id: args.departmentId,
      title,
      description: "Organic social media KPI targets synced from Insight Report.",
      status: "active",
      weight: 100,
      created_by: args.createdBy,
    })
    .select("id")
    .single();

  if (createError) throw createError;
  return created.id;
}

async function findOrCreateInsightMetricIndividualObjective(args: {
  supabase: SupabaseClient;
  organizationId: string;
  cycleId: string;
  employeeId: string;
  departmentObjectiveId: string;
  title: string;
  progressPercentage: number;
  createdBy: string;
}): Promise<string> {
  const { data: existing, error: findError } = await args.supabase
    .from("individual_objectives")
    .select("id, department_objective_id")
    .eq("organization_id", args.organizationId)
    .eq("cycle_id", args.cycleId)
    .eq("employee_id", args.employeeId)
    .eq("title", args.title)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const { error: updateError } = await args.supabase
      .from("individual_objectives")
      .update({
        department_objective_id: args.departmentObjectiveId,
        progress_percentage: args.progressPercentage,
        status: "active",
      })
      .eq("id", existing.id);
    if (updateError) throw updateError;
    return existing.id;
  }

  const { data: created, error: createError } = await args.supabase
    .from("individual_objectives")
    .insert({
      organization_id: args.organizationId,
      cycle_id: args.cycleId,
      employee_id: args.employeeId,
      department_objective_id: args.departmentObjectiveId,
      title: args.title,
      description: "Social media metric target synced from Insight Report.",
      status: "active",
      weight: 100,
      progress_percentage: args.progressPercentage,
      created_by: args.createdBy,
    })
    .select("id")
    .single();

  if (createError) throw createError;
  return created.id;
}

async function rollupDepartmentObjectiveProgress(
  supabase: SupabaseClient,
  departmentObjectiveId: string,
): Promise<void> {
  const { data: children, error } = await supabase
    .from("individual_objectives")
    .select("progress_percentage")
    .eq("department_objective_id", departmentObjectiveId)
    .eq("status", "active");

  if (error) throw error;
  if (!children || children.length === 0) return;

  const avg =
    children.reduce((sum, c) => sum + Number(c.progress_percentage ?? 0), 0) / children.length;

  const { error: updateError } = await supabase
    .from("department_objectives")
    .update({ progress_percentage: Math.round(avg) })
    .eq("id", departmentObjectiveId);

  if (updateError) throw updateError;
}

export async function syncInsightTargetsToOkr(args: {
  supabase: SupabaseClient;
  organizationId: string;
  period: InsightTargetPeriodKey;
  createdBy: string;
  cycles: OkrCycle[];
  accountRefs: InsightTargetAccountRef[];
  accountActuals?: AccountActualsMap;
  companyObjectiveId: string;
  departmentId: string;
}): Promise<InsightOkrSyncResult> {
  const filter = periodKeyToQueryFilter(args.period);
  const cycle = resolveOkrCycleForInsightPeriod(args.period, args.cycles);

  if (!cycle) {
    return {
      syncedIndividualObjectiveCount: 0,
      skippedNoCycle: true,
      cycleId: null,
      syncedDepartmentObjectiveId: null,
    };
  }

  await cleanupLegacyInsightSyncForPeriod({
    supabase: args.supabase,
    organizationId: args.organizationId,
    period: args.period,
    cycleId: cycle.id,
  });

  const departmentObjectiveId = await findOrCreateInsightDepartmentObjective({
    supabase: args.supabase,
    organizationId: args.organizationId,
    cycleId: cycle.id,
    companyObjectiveId: args.companyObjectiveId,
    departmentId: args.departmentId,
    period: args.period,
    createdBy: args.createdBy,
  });

  let targetsQuery = args.supabase
    .from("social_media_insight_targets")
    .select("*")
    .eq("organization_id", args.organizationId)
    .eq("period_type", filter.period_type)
    .eq("year", filter.year);

  if (filter.period_type === "monthly" && filter.month != null) {
    targetsQuery = targetsQuery.eq("month", filter.month);
  }
  if (filter.period_type === "quarterly" && filter.quarter != null) {
    targetsQuery = targetsQuery.eq("quarter", filter.quarter);
  }

  const { data: targets, error: targetsError } = await targetsQuery;
  if (targetsError) throw targetsError;

  let assignmentsQuery = args.supabase
    .from("social_media_insight_target_assignments")
    .select("*")
    .eq("organization_id", args.organizationId)
    .eq("period_type", filter.period_type)
    .eq("year", filter.year);

  if (filter.period_type === "monthly" && filter.month != null) {
    assignmentsQuery = assignmentsQuery.eq("month", filter.month);
  }
  if (filter.period_type === "quarterly" && filter.quarter != null) {
    assignmentsQuery = assignmentsQuery.eq("quarter", filter.quarter);
  }

  const { data: assignments, error: assignmentsError } = await assignmentsQuery;
  if (assignmentsError) throw assignmentsError;

  const assignmentByAccount = new Map<string, SocialMediaInsightTargetAssignmentRow>();
  for (const row of (assignments ?? []) as SocialMediaInsightTargetAssignmentRow[]) {
    assignmentByAccount.set(accountActualsKey(row.platform, row.account_id), row);
  }

  const accountLabelByKey = new Map<string, string>();
  for (const ref of args.accountRefs) {
    accountLabelByKey.set(accountActualsKey(ref.platform, ref.accountId), ref.accountLabel);
  }

  let syncedIndividualObjectiveCount = 0;

  for (const row of (targets ?? []) as SocialMediaInsightTargetRow[]) {
    const targetValue = Number(row.target_value);
    const accountKey = accountActualsKey(row.platform, row.account_id);
    const assignment = assignmentByAccount.get(accountKey);

    if (!assignment || targetValue <= 0) {
      if (row.individual_objective_id) {
        await deleteIndividualObjective(args.supabase, row.individual_objective_id);
        const { error: clearError } = await args.supabase
          .from("social_media_insight_targets")
          .update({ individual_objective_id: null })
          .eq("id", row.id);
        if (clearError) throw clearError;
      }
      continue;
    }

    const accountLabel = accountLabelByKey.get(accountKey) ?? row.account_id;
    const title = buildInsightMetricObjectiveTitle({
      platform: row.platform,
      accountLabel,
      metric: row.metric,
      period: args.period,
    });

    const actuals = args.accountActuals?.get(accountKey);
    const actual =
      actuals != null ? actualValueForMetric(actuals, row.metric) : null;
    const progress = insightKeyResultProgress(row.metric, actual, targetValue);

    const ioId = await findOrCreateInsightMetricIndividualObjective({
      supabase: args.supabase,
      organizationId: args.organizationId,
      cycleId: cycle.id,
      employeeId: assignment.employee_id,
      departmentObjectiveId,
      title,
      progressPercentage: progress,
      createdBy: args.createdBy,
    });

    const { error: linkError } = await args.supabase
      .from("social_media_insight_targets")
      .update({ individual_objective_id: ioId })
      .eq("id", row.id);
    if (linkError) throw linkError;

    syncedIndividualObjectiveCount += 1;
  }

  await rollupDepartmentObjectiveProgress(args.supabase, departmentObjectiveId);

  return {
    syncedIndividualObjectiveCount,
    skippedNoCycle: false,
    cycleId: cycle.id,
    syncedDepartmentObjectiveId: departmentObjectiveId,
  };
}
