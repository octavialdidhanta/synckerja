import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resolveGoogleAdsFirstPicDepartmentId } from "@/6-0-digital-marketing-shared/googleAdsReportTargetFirstPicDepartment";
import { syncGoogleAdsIndividualObjectiveProgress } from "@/6-0-digital-marketing-shared/googleAdsReportTargetOkrProgressSync";
import { resolveOkrCycleForGoogleAdsReportPeriod } from "@/6-0-digital-marketing-shared/googleAdsReportTargetOkrCycleResolver";
import {
  syncGoogleAdsReportTargetsToOkr,
  type GoogleAdsOkrSyncResult,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetOkrSync";
import { periodKeyToQueryFilter } from "@/6-0-digital-marketing-shared/googleAdsReportTargetPeriod";
import { googleAdsReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/googleAdsReportTargetQueryKeys";
import { requiresCompanyObjectiveForGoogleAdsSave } from "@/6-0-digital-marketing-shared/googleAdsReportTargetSaveValidation";
import type {
  GoogleAdsAccountPeriodActuals,
  GoogleAdsReportTargetAccountAssignment,
  GoogleAdsReportTargetAccountRef,
  GoogleAdsReportTargetFormValue,
  GoogleAdsReportTargetPeriodKey,
  GoogleAdsReportTargetRow,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";
import type { MetricValueKind } from "@/google-ads/metrics/types";

export type SaveGoogleAdsReportTargetsResult = {
  targets: GoogleAdsReportTargetRow[];
  okrSync: GoogleAdsOkrSyncResult;
};

type SaveArgs = {
  period: GoogleAdsReportTargetPeriodKey;
  values: GoogleAdsReportTargetFormValue[];
  assignments: GoogleAdsReportTargetAccountAssignment[];
  accountRefs: GoogleAdsReportTargetAccountRef[];
  accountActuals?: Map<string, GoogleAdsAccountPeriodActuals>;
  createdBy: string;
  companyObjectiveId: string | null;
  selectedMetrics: string[];
  metricLabels: Record<string, string>;
  metricValueKinds: Record<string, MetricValueKind>;
};

async function savePeriodSettings(
  organizationId: string,
  period: GoogleAdsReportTargetPeriodKey,
  companyObjectiveId: string | null,
  syncedDepartmentObjectiveId: string | null,
  selectedMetrics: string[],
): Promise<void> {
  const filter = periodKeyToQueryFilter(period);

  let findQuery = supabase
    .from("google_ads_report_target_period_settings")
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
        .from("google_ads_report_target_period_settings")
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
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("google_ads_report_target_period_settings")
      .update(payload)
      .eq("id", existing.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from("google_ads_report_target_period_settings")
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

function targetRowKey(row: { google_customer_id: string; metric_key: string }): string {
  return `${row.google_customer_id}:${row.metric_key}`;
}

function desiredValueKey(v: GoogleAdsReportTargetFormValue): string {
  return `${v.customerId}:${v.metricKey}`;
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
  period: GoogleAdsReportTargetPeriodKey,
  assignments: GoogleAdsReportTargetAccountAssignment[],
): Promise<void> {
  const filter = periodKeyToQueryFilter(period);

  let existingQuery = supabase
    .from("google_ads_report_target_assignments")
    .select("id, google_customer_id")
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

  const desiredKeys = new Set(assignments.map((a) => a.customerId));

  for (const row of existing ?? []) {
    if (!desiredKeys.has(row.google_customer_id)) {
      const { error } = await supabase
        .from("google_ads_report_target_assignments")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
    }
  }

  for (const assignment of assignments) {
    let findQuery = supabase
      .from("google_ads_report_target_assignments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("google_customer_id", assignment.customerId)
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
        .from("google_ads_report_target_assignments")
        .update({ employee_id: assignment.employeeId })
        .eq("id", found.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("google_ads_report_target_assignments")
        .insert({
          organization_id: organizationId,
          google_customer_id: assignment.customerId,
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
  period: GoogleAdsReportTargetPeriodKey,
  values: GoogleAdsReportTargetFormValue[],
): Promise<GoogleAdsReportTargetRow[]> {
  const filter = periodKeyToQueryFilter(period);

  let existingQuery = supabase
    .from("google_ads_report_targets")
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

  const existingByKey = new Map<string, GoogleAdsReportTargetRow>();
  for (const row of (existingRows ?? []) as GoogleAdsReportTargetRow[]) {
    existingByKey.set(targetRowKey(row), row);
  }

  const desiredByKey = new Map<string, GoogleAdsReportTargetFormValue>();
  for (const v of values.filter((x) => x.targetValue > 0)) {
    desiredByKey.set(desiredValueKey(v), v);
  }

  for (const [key, row] of existingByKey) {
    if (!desiredByKey.has(key)) {
      await deleteIndividualObjectiveIfAny(row.individual_objective_id);
      const { error } = await supabase
        .from("google_ads_report_targets")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
    }
  }

  const saved: GoogleAdsReportTargetRow[] = [];

  for (const [, value] of desiredByKey) {
    const key = desiredValueKey(value);
    const existing = existingByKey.get(key);
    if (existing) {
      const { data, error } = await supabase
        .from("google_ads_report_targets")
        .update({ target_value: value.targetValue })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      saved.push(data as GoogleAdsReportTargetRow);
    } else {
      const { data, error } = await supabase
        .from("google_ads_report_targets")
        .insert({
          organization_id: organizationId,
          google_customer_id: value.customerId,
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
      saved.push(data as GoogleAdsReportTargetRow);
    }
  }

  return saved;
}

export function useGoogleAdsReportTargetsMutations() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const saveTargets = useMutation({
    mutationFn: async (args: SaveArgs): Promise<SaveGoogleAdsReportTargetsResult> => {
      if (!organizationId) throw new Error("Organization ID is required");

      const needsCompanyObjective = requiresCompanyObjectiveForGoogleAdsSave(
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
      const resolvedCycle = resolveOkrCycleForGoogleAdsReportPeriod(args.period, resolvedCycles);

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
        departmentId = await resolveGoogleAdsFirstPicDepartmentId(supabase, args.assignments);
        if (!departmentId) {
          throw new Error("PIC_DEPARTMENT_REQUIRED");
        }
      }

      await saveAssignments(organizationId, args.period, args.assignments);
      const targets = await saveTargetRows(organizationId, args.period, args.values);

      const actualsMap = args.accountActuals ?? new Map<string, GoogleAdsAccountPeriodActuals>();

      let okrSync: GoogleAdsOkrSyncResult = {
        syncedIndividualObjectiveCount: 0,
        skippedNoCycle: true,
        cycleId: null,
        syncedDepartmentObjectiveId: null,
      };

      if (needsCompanyObjective && args.companyObjectiveId && resolvedCycle && departmentId) {
        okrSync = await syncGoogleAdsReportTargetsToOkr({
          supabase,
          organizationId,
          period: args.period,
          createdBy: args.createdBy,
          cycles: resolvedCycles,
          accountRefs: args.accountRefs,
          accountActuals: actualsMap,
          metricLabels: args.metricLabels,
          metricValueKinds: args.metricValueKinds,
          companyObjectiveId: args.companyObjectiveId,
          departmentId,
        });

        await savePeriodSettings(
          organizationId,
          args.period,
          args.companyObjectiveId,
          okrSync.syncedDepartmentObjectiveId,
          args.selectedMetrics,
        );
      } else if (!needsCompanyObjective) {
        await savePeriodSettings(organizationId, args.period, null, null, args.selectedMetrics);
      } else {
        await savePeriodSettings(
          organizationId,
          args.period,
          args.companyObjectiveId,
          null,
          args.selectedMetrics,
        );
      }

      if (!okrSync.skippedNoCycle) {
        await syncGoogleAdsIndividualObjectiveProgress({
          supabase,
          organizationId,
          period: args.period,
          accountActuals: actualsMap,
          metricValueKinds: args.metricValueKinds,
        });
      }

      return { targets, okrSync };
    },
    onSuccess: (_data, variables) => {
      if (!organizationId) return;
      queryClient.invalidateQueries({
        queryKey: googleAdsReportTargetQueryKeys.targets(organizationId, variables.period),
      });
      queryClient.invalidateQueries({
        queryKey: googleAdsReportTargetQueryKeys.assignments(organizationId, variables.period),
      });
      queryClient.invalidateQueries({
        queryKey: googleAdsReportTargetQueryKeys.periodSettings(organizationId, variables.period),
      });
      queryClient.invalidateQueries({
        queryKey: googleAdsReportTargetQueryKeys.metricsByObjective(organizationId),
      });
      queryClient.invalidateQueries({ queryKey: ["individual-objectives"] });
      queryClient.invalidateQueries({ queryKey: ["department-objectives"] });
      queryClient.invalidateQueries({ queryKey: ["company-objectives"] });
    },
  });

  return { saveTargets };
}
