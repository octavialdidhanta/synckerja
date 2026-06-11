import { buildDmReportMetricObjectiveTitle } from "@/6-0-digital-marketing-shared/dmReportTargetMetricObjectiveTitle";
import {
  buildDmReportObjectiveTitle,
  resolveOkrCycleForDmReportPeriod,
} from "@/6-0-digital-marketing-shared/dmReportTargetOkrCycleResolver";
import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { dmKeyResultProgress } from "@/6-0-digital-marketing-shared/dmReportTargetOkrProgress";
import { actualValueForAccount } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { periodKeyToQueryFilter } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  dmTargetAccountKey,
  type DmAccountPeriodActuals,
  type DmReportTargetAccountRef,
  type DmReportTargetAssignmentRow,
  type DmReportTargetPeriodKey,
  type DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { DmReportMetricValueKind } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DmOkrSyncResult = {
  syncedIndividualObjectiveCount: number;
  skippedNoCycle: boolean;
  cycleId: string | null;
  syncedDepartmentObjectiveId: string | null;
};

type AccountActualsMap = Map<string, DmAccountPeriodActuals>;

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
  period: DmReportTargetPeriodKey;
  createdBy: string;
}): Promise<string> {
  const title = buildDmReportObjectiveTitle(args.period);

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
      description: "Paid ads KPI targets synced from Digital Marketing Report.",
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
      description: "Paid ads metric target synced from Digital Marketing Report.",
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

export async function syncDmReportTargetsToOkr(args: {
  supabase: SupabaseClient;
  organizationId: string;
  period: DmReportTargetPeriodKey;
  createdBy: string;
  cycles: OkrCycle[];
  accountRefs: DmReportTargetAccountRef[];
  accountActuals?: AccountActualsMap;
  metricLabels: Record<string, string>;
  metricValueKinds: Record<string, DmReportMetricValueKind>;
  metricDirections?: DmReportMetricDirectionsMap | null;
  companyObjectiveId: string;
  departmentId: string;
}): Promise<DmOkrSyncResult> {
  const filter = periodKeyToQueryFilter(args.period);
  const cycle = resolveOkrCycleForDmReportPeriod(args.period, args.cycles);

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
    .from("digital_marketing_report_targets")
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
    .from("digital_marketing_report_target_assignments")
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

  const assignmentByAccount = new Map<string, DmReportTargetAssignmentRow>();
  for (const row of (assignments ?? []) as DmReportTargetAssignmentRow[]) {
    assignmentByAccount.set(dmTargetAccountKey(row.channel, row.account_id), row);
  }

  const accountLabelByKey = new Map<string, string>();
  for (const ref of args.accountRefs) {
    accountLabelByKey.set(dmTargetAccountKey(ref.channel, ref.accountId), ref.accountLabel);
  }

  let syncedIndividualObjectiveCount = 0;

  for (const row of (targets ?? []) as DmReportTargetRow[]) {
    const targetValue = Number(row.target_value);
    const accountKey = dmTargetAccountKey(row.channel, row.account_id);
    const assignment = assignmentByAccount.get(accountKey);

    if (!assignment || targetValue <= 0) {
      if (row.individual_objective_id) {
        await deleteIndividualObjective(args.supabase, row.individual_objective_id);
        const { error: clearError } = await args.supabase
          .from("digital_marketing_report_targets")
          .update({ individual_objective_id: null })
          .eq("id", row.id);
        if (clearError) throw clearError;
      }
      continue;
    }

    const accountLabel = accountLabelByKey.get(accountKey) ?? row.account_id;
    const metricLabel = args.metricLabels[row.metric_key] ?? row.metric_key;
    const valueKind = args.metricValueKinds[row.metric_key] ?? "count";
    const title = buildDmReportMetricObjectiveTitle({
      channel: row.channel,
      accountLabel,
      metricLabel,
      period: args.period,
    });

    const actuals = args.accountActuals?.get(accountKey);
    const actual = actuals != null ? actualValueForAccount(actuals, row.metric_key) : null;
    const progress = dmKeyResultProgress(
      row.metric_key,
      valueKind,
      actual,
      targetValue,
      args.metricDirections,
    );

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
      .from("digital_marketing_report_targets")
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
