import { buildGoogleAdsReportMetricObjectiveTitle } from "@/6-0-digital-marketing-shared/googleAdsReportTargetMetricObjectiveTitle";
import {
  buildGoogleAdsReportObjectiveTitle,
  resolveOkrCycleForGoogleAdsReportPeriod,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetOkrCycleResolver";
import { googleAdsKeyResultProgress } from "@/6-0-digital-marketing-shared/googleAdsReportTargetOkrProgress";
import { actualValueForAccount } from "@/6-0-digital-marketing-shared/googleAdsReportTargetActuals";
import { periodKeyToQueryFilter } from "@/6-0-digital-marketing-shared/googleAdsReportTargetPeriod";
import type {
  GoogleAdsAccountPeriodActuals,
  GoogleAdsReportTargetAccountRef,
  GoogleAdsReportTargetAssignmentRow,
  GoogleAdsReportTargetPeriodKey,
  GoogleAdsReportTargetRow,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import type { MetricValueKind } from "@/google-ads/metrics/types";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GoogleAdsOkrSyncResult = {
  syncedIndividualObjectiveCount: number;
  skippedNoCycle: boolean;
  cycleId: string | null;
  syncedDepartmentObjectiveId: string | null;
};

type AccountActualsMap = Map<string, GoogleAdsAccountPeriodActuals>;

async function deleteIndividualObjective(
  supabase: SupabaseClient,
  objectiveId: string,
): Promise<void> {
  const { error } = await supabase.from("individual_objectives").delete().eq("id", objectiveId);
  if (error) throw error;
}

async function findOrCreateDepartmentObjective(args: {
  supabase: SupabaseClient;
  organizationId: string;
  cycleId: string;
  companyObjectiveId: string;
  departmentId: string;
  period: GoogleAdsReportTargetPeriodKey;
  createdBy: string;
}): Promise<string> {
  const title = buildGoogleAdsReportObjectiveTitle(args.period);

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
      description: "Google Ads KPI targets synced from Digital Marketing Report.",
      status: "active",
      weight: 100,
      created_by: args.createdBy,
    })
    .select("id")
    .single();

  if (createError) throw createError;
  return created.id;
}

async function findOrCreateMetricIndividualObjective(args: {
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
      description: "Google Ads metric target synced from Digital Marketing Report.",
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

export async function syncGoogleAdsReportTargetsToOkr(args: {
  supabase: SupabaseClient;
  organizationId: string;
  period: GoogleAdsReportTargetPeriodKey;
  createdBy: string;
  cycles: OkrCycle[];
  accountRefs: GoogleAdsReportTargetAccountRef[];
  accountActuals?: AccountActualsMap;
  metricLabels: Record<string, string>;
  metricValueKinds: Record<string, MetricValueKind>;
  companyObjectiveId: string;
  departmentId: string;
}): Promise<GoogleAdsOkrSyncResult> {
  const filter = periodKeyToQueryFilter(args.period);
  const cycle = resolveOkrCycleForGoogleAdsReportPeriod(args.period, args.cycles);

  if (!cycle) {
    return {
      syncedIndividualObjectiveCount: 0,
      skippedNoCycle: true,
      cycleId: null,
      syncedDepartmentObjectiveId: null,
    };
  }

  const departmentObjectiveId = await findOrCreateDepartmentObjective({
    supabase: args.supabase,
    organizationId: args.organizationId,
    cycleId: cycle.id,
    companyObjectiveId: args.companyObjectiveId,
    departmentId: args.departmentId,
    period: args.period,
    createdBy: args.createdBy,
  });

  let targetsQuery = args.supabase
    .from("google_ads_report_targets")
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
    .from("google_ads_report_target_assignments")
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

  const assignmentByAccount = new Map<string, GoogleAdsReportTargetAssignmentRow>();
  for (const row of (assignments ?? []) as GoogleAdsReportTargetAssignmentRow[]) {
    assignmentByAccount.set(row.google_customer_id, row);
  }

  const accountLabelByKey = new Map<string, string>();
  for (const ref of args.accountRefs) {
    accountLabelByKey.set(ref.customerId, ref.accountLabel);
  }

  let syncedIndividualObjectiveCount = 0;

  for (const row of (targets ?? []) as GoogleAdsReportTargetRow[]) {
    const targetValue = Number(row.target_value);
    const assignment = assignmentByAccount.get(row.google_customer_id);

    if (!assignment || targetValue <= 0) {
      if (row.individual_objective_id) {
        await deleteIndividualObjective(args.supabase, row.individual_objective_id);
        const { error: clearError } = await args.supabase
          .from("google_ads_report_targets")
          .update({ individual_objective_id: null })
          .eq("id", row.id);
        if (clearError) throw clearError;
      }
      continue;
    }

    const accountLabel = accountLabelByKey.get(row.google_customer_id) ?? row.google_customer_id;
    const metricLabel = args.metricLabels[row.metric_key] ?? row.metric_key;
    const valueKind = args.metricValueKinds[row.metric_key] ?? "count";
    const title = buildGoogleAdsReportMetricObjectiveTitle({
      accountLabel,
      metricLabel,
      period: args.period,
    });

    const actuals = args.accountActuals?.get(row.google_customer_id);
    const actual =
      actuals != null ? actualValueForAccount(actuals, row.metric_key) : null;
    const progress = googleAdsKeyResultProgress(row.metric_key, valueKind, actual, targetValue);

    const ioId = await findOrCreateMetricIndividualObjective({
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
      .from("google_ads_report_targets")
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
