import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resolveDmFirstPicDepartmentId } from "@/6-0-digital-marketing-shared/dmReportTargetFirstPicDepartment";
import { syncDmIndividualObjectiveProgress } from "@/6-0-digital-marketing-shared/dmReportTargetOkrProgressSync";
import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { resolveOkrCycleForDmReportPeriod } from "@/6-0-digital-marketing-shared/dmReportTargetOkrCycleResolver";
import {
  syncDmReportTargetsToOkr,
  type DmOkrSyncResult,
} from "@/6-0-digital-marketing-shared/dmReportTargetOkrSync";
import { periodKeyToQueryFilter } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import { dmReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/dmReportTargetQueryKeys";
import { unionChannelMetrics, type DmReportChannelMetricsMap } from "@/6-0-digital-marketing-shared/dmReportTargetMetricsByChannel";
import { requiresCompanyObjectiveForDmSave } from "@/6-0-digital-marketing-shared/dmReportTargetSaveValidation";
import {
  dmTargetAccountKey,
  type DmAccountPeriodActuals,
  type DmReportMetricValueKind,
  type DmReportTargetAccountAssignment,
  type DmReportTargetAccountRef,
  type DmReportTargetFormValue,
  type DmReportTargetPeriodKey,
  type DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";

export type SaveDmReportTargetsResult = {
  targets: DmReportTargetRow[];
  okrSync: DmOkrSyncResult;
};

type SaveArgs = {
  period: DmReportTargetPeriodKey;
  values: DmReportTargetFormValue[];
  assignments: DmReportTargetAccountAssignment[];
  accountRefs: DmReportTargetAccountRef[];
  accountActuals?: Map<string, DmAccountPeriodActuals>;
  createdBy: string;
  companyObjectiveId: string | null;
  selectedMetricsByChannel: DmReportChannelMetricsMap;
  metricDirections: DmReportMetricDirectionsMap;
  metricLabels: Record<string, string>;
  metricValueKinds: Record<string, DmReportMetricValueKind>;
};

async function savePeriodSettings(
  organizationId: string,
  period: DmReportTargetPeriodKey,
  companyObjectiveId: string | null,
  syncedDepartmentObjectiveId: string | null,
  selectedMetricsByChannel: DmReportChannelMetricsMap,
  metricDirections: DmReportMetricDirectionsMap,
): Promise<void> {
  const selectedMetrics = unionChannelMetrics(selectedMetricsByChannel);
  const filter = periodKeyToQueryFilter(period);

  let findQuery = supabase
    .from("digital_marketing_report_target_period_settings")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("period_type", filter.period_type)
    .eq("year", filter.year);

  if (filter.period_type === "monthly" && filter.month != null) {
    findQuery = findQuery.eq("month", filter.month);
  }
  if (filter.period_type === "quarterly" && filter.quarter != null) {
    findQuery = findQuery.eq("quarter", filter.quarter);
  }

  const { data: existing, error: findError } = await findQuery.maybeSingle();
  if (findError) throw findError;

  if (!companyObjectiveId) {
    if (existing?.id) {
      const { error: deleteError } = await supabase
        .from("digital_marketing_report_target_period_settings")
        .delete()
        .eq("id", existing.id);
      if (deleteError) throw deleteError;
    }
    return;
  }

  const payload = {
    company_objective_id: companyObjectiveId,
    synced_department_objective_id: syncedDepartmentObjectiveId,
    selected_metrics: selectedMetrics,
    selected_metrics_by_channel: selectedMetricsByChannel,
    metric_directions: metricDirections,
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("digital_marketing_report_target_period_settings")
      .update(payload)
      .eq("id", existing.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from("digital_marketing_report_target_period_settings")
      .insert({
        organization_id: organizationId,
        period_type: filter.period_type,
        year: filter.year,
        month: filter.period_type === "monthly" ? filter.month ?? null : null,
        quarter: filter.period_type === "quarterly" ? filter.quarter ?? null : null,
        ...payload,
      });
    if (insertError) throw insertError;
  }
}

function targetRowKey(row: { channel: string; account_id: string; metric_key: string }): string {
  return `${row.channel}:${row.account_id}:${row.metric_key}`;
}

function desiredValueKey(v: DmReportTargetFormValue): string {
  return `${v.channel}:${v.accountId}:${v.metricKey}`;
}

async function deleteIndividualObjectiveIfAny(
  objectiveId: string | null | undefined,
): Promise<void> {
  if (!objectiveId) return;
  const { error } = await supabase.from("individual_objectives").delete().eq("id", objectiveId);
  if (error) throw error;
}

async function saveAssignments(
  organizationId: string,
  period: DmReportTargetPeriodKey,
  assignments: DmReportTargetAccountAssignment[],
): Promise<void> {
  const filter = periodKeyToQueryFilter(period);

  let existingQuery = supabase
    .from("digital_marketing_report_target_assignments")
    .select("id, channel, account_id")
    .eq("organization_id", organizationId)
    .eq("period_type", filter.period_type)
    .eq("year", filter.year);

  if (filter.period_type === "monthly" && filter.month != null) {
    existingQuery = existingQuery.eq("month", filter.month);
  }
  if (filter.period_type === "quarterly" && filter.quarter != null) {
    existingQuery = existingQuery.eq("quarter", filter.quarter);
  }

  const { data: existing, error: existingError } = await existingQuery;
  if (existingError) throw existingError;

  const desiredKeys = new Set(
    assignments.map((a) => dmTargetAccountKey(a.channel, a.accountId)),
  );

  for (const row of existing ?? []) {
    const key = dmTargetAccountKey(row.channel, row.account_id);
    if (!desiredKeys.has(key)) {
      const { error } = await supabase
        .from("digital_marketing_report_target_assignments")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
    }
  }

  for (const assignment of assignments) {
    let findQuery = supabase
      .from("digital_marketing_report_target_assignments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("channel", assignment.channel)
      .eq("account_id", assignment.accountId)
      .eq("period_type", filter.period_type)
      .eq("year", filter.year);

    if (filter.period_type === "monthly" && filter.month != null) {
      findQuery = findQuery.eq("month", filter.month);
    }
    if (filter.period_type === "quarterly" && filter.quarter != null) {
      findQuery = findQuery.eq("quarter", filter.quarter);
    }

    const { data: found, error: findError } = await findQuery.maybeSingle();
    if (findError) throw findError;

    if (found?.id) {
      const { error: updateError } = await supabase
        .from("digital_marketing_report_target_assignments")
        .update({ employee_id: assignment.employeeId })
        .eq("id", found.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("digital_marketing_report_target_assignments")
        .insert({
          organization_id: organizationId,
          channel: assignment.channel,
          account_id: assignment.accountId,
          period_type: filter.period_type,
          year: filter.year,
          month: filter.period_type === "monthly" ? filter.month ?? null : null,
          quarter: filter.period_type === "quarterly" ? filter.quarter ?? null : null,
          employee_id: assignment.employeeId,
        });
      if (insertError) throw insertError;
    }
  }
}

async function saveTargetRows(
  organizationId: string,
  period: DmReportTargetPeriodKey,
  values: DmReportTargetFormValue[],
): Promise<DmReportTargetRow[]> {
  const filter = periodKeyToQueryFilter(period);

  let existingQuery = supabase
    .from("digital_marketing_report_targets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("period_type", filter.period_type)
    .eq("year", filter.year);

  if (filter.period_type === "monthly" && filter.month != null) {
    existingQuery = existingQuery.eq("month", filter.month);
  }
  if (filter.period_type === "quarterly" && filter.quarter != null) {
    existingQuery = existingQuery.eq("quarter", filter.quarter);
  }

  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) throw existingError;

  const existingByKey = new Map<string, DmReportTargetRow>();
  for (const row of (existingRows ?? []) as DmReportTargetRow[]) {
    existingByKey.set(targetRowKey(row), row);
  }

  const desiredByKey = new Map<string, DmReportTargetFormValue>();
  for (const v of values.filter((x) => x.targetValue > 0)) {
    desiredByKey.set(desiredValueKey(v), v);
  }

  for (const [key, row] of existingByKey) {
    if (!desiredByKey.has(key)) {
      await deleteIndividualObjectiveIfAny(row.individual_objective_id);
      const { error } = await supabase
        .from("digital_marketing_report_targets")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
    }
  }

  const saved: DmReportTargetRow[] = [];

  for (const [, value] of desiredByKey) {
    const key = desiredValueKey(value);
    const existing = existingByKey.get(key);
    if (existing) {
      const { data, error } = await supabase
        .from("digital_marketing_report_targets")
        .update({ target_value: value.targetValue })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      saved.push(data as DmReportTargetRow);
    } else {
      const { data, error } = await supabase
        .from("digital_marketing_report_targets")
        .insert({
          organization_id: organizationId,
          channel: value.channel,
          account_id: value.accountId,
          metric_key: value.metricKey,
          period_type: filter.period_type,
          year: filter.year,
          month: filter.period_type === "monthly" ? filter.month ?? null : null,
          quarter: filter.period_type === "quarterly" ? filter.quarter ?? null : null,
          target_value: value.targetValue,
        })
        .select()
        .single();
      if (error) throw error;
      saved.push(data as DmReportTargetRow);
    }
  }

  return saved;
}

export function useDmReportTargetsMutations() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const saveTargets = useMutation({
    mutationFn: async (args: SaveArgs): Promise<SaveDmReportTargetsResult> => {
      if (!organizationId) throw new Error("Organization ID is required");

      const needsCompanyObjective = requiresCompanyObjectiveForDmSave(
        args.values,
        args.assignments,
      );
      if (needsCompanyObjective && !args.companyObjectiveId) {
        throw new Error("COMPANY_OBJECTIVE_REQUIRED");
      }

      if (needsCompanyObjective && args.assignments.length === 0) {
        throw new Error("PIC_REQUIRED_FOR_DEPARTMENT");
      }

      const { data: cycles, error: cyclesError } = await supabase
        .from("okr_cycles")
        .select("*")
        .eq("organization_id", organizationId)
        .order("start_date", { ascending: false });

      if (cyclesError) throw cyclesError;

      const resolvedCycles = (cycles ?? []) as OkrCycle[];
      const resolvedCycle = resolveOkrCycleForDmReportPeriod(args.period, resolvedCycles);

      if (needsCompanyObjective && args.companyObjectiveId) {
        const { data: companyObj, error: companyError } = await supabase
          .from("company_objectives")
          .select("cycle_id, status")
          .eq("id", args.companyObjectiveId)
          .eq("organization_id", organizationId)
          .single();
        if (companyError) throw companyError;
        if (companyObj.status !== "active") {
          throw new Error("COMPANY_OBJECTIVE_INACTIVE");
        }
        if (!resolvedCycle || companyObj.cycle_id !== resolvedCycle.id) {
          throw new Error("COMPANY_OBJECTIVE_CYCLE_MISMATCH");
        }
      }

      let departmentId: string | null = null;
      if (needsCompanyObjective) {
        departmentId = await resolveDmFirstPicDepartmentId(supabase, args.assignments);
        if (!departmentId) {
          throw new Error("PIC_DEPARTMENT_REQUIRED");
        }
      }

      await saveAssignments(organizationId, args.period, args.assignments);
      const targets = await saveTargetRows(organizationId, args.period, args.values);

      const actualsMap = args.accountActuals ?? new Map<string, DmAccountPeriodActuals>();

      let okrSync: DmOkrSyncResult = {
        syncedIndividualObjectiveCount: 0,
        skippedNoCycle: true,
        cycleId: null,
        syncedDepartmentObjectiveId: null,
      };

      if (needsCompanyObjective && args.companyObjectiveId && resolvedCycle && departmentId) {
        okrSync = await syncDmReportTargetsToOkr({
          supabase,
          organizationId,
          period: args.period,
          createdBy: args.createdBy,
          cycles: resolvedCycles,
          accountRefs: args.accountRefs,
          accountActuals: actualsMap,
          metricLabels: args.metricLabels,
          metricValueKinds: args.metricValueKinds,
          metricDirections: args.metricDirections,
          companyObjectiveId: args.companyObjectiveId,
          departmentId,
        });

        await savePeriodSettings(
          organizationId,
          args.period,
          args.companyObjectiveId,
          okrSync.syncedDepartmentObjectiveId,
          args.selectedMetricsByChannel,
          args.metricDirections,
        );
      } else if (!needsCompanyObjective) {
        if (args.companyObjectiveId) {
          await savePeriodSettings(
            organizationId,
            args.period,
            args.companyObjectiveId,
            null,
            args.selectedMetricsByChannel,
            args.metricDirections,
          );
        } else {
          await savePeriodSettings(
            organizationId,
            args.period,
            null,
            null,
            args.selectedMetricsByChannel,
            args.metricDirections,
          );
        }
      } else {
        await savePeriodSettings(
          organizationId,
          args.period,
          args.companyObjectiveId,
          null,
          args.selectedMetricsByChannel,
          args.metricDirections,
        );
      }

      if (!okrSync.skippedNoCycle) {
        await syncDmIndividualObjectiveProgress({
          supabase,
          organizationId,
          period: args.period,
          accountActuals: actualsMap,
          metricValueKinds: args.metricValueKinds,
          metricDirections: args.metricDirections,
        });
      }

      return { targets, okrSync };
    },
    onSuccess: (_data, variables) => {
      if (!organizationId) return;
      queryClient.invalidateQueries({
        queryKey: dmReportTargetQueryKeys.targets(organizationId, variables.period),
      });
      queryClient.invalidateQueries({
        queryKey: dmReportTargetQueryKeys.assignments(organizationId, variables.period),
      });
      queryClient.invalidateQueries({
        queryKey: dmReportTargetQueryKeys.periodSettings(organizationId, variables.period),
      });
      queryClient.invalidateQueries({
        queryKey: dmReportTargetQueryKeys.metricsByObjective(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: dmReportTargetQueryKeys.objectiveProgress(organizationId),
      });
      queryClient.invalidateQueries({ queryKey: ["individual-objectives"] });
      queryClient.invalidateQueries({ queryKey: ["department-objectives"] });
      queryClient.invalidateQueries({ queryKey: ["company-objectives"] });
    },
  });

  return { saveTargets };
}
