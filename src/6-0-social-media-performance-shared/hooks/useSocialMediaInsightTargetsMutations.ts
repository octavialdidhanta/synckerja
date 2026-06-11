import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resolveFirstPicDepartmentId } from "@/6-0-social-media-performance-shared/insightTargetFirstPicDepartment";
import { resolveOkrCycleForInsightPeriod } from "@/6-0-social-media-performance-shared/insightTargetOkrCycleResolver";
import { syncInsightIndividualObjectiveProgress } from "@/6-0-social-media-performance-shared/insightTargetOkrProgressSync";
import { syncInsightTargetsToOkr } from "@/6-0-social-media-performance-shared/insightTargetOkrSync";
import { requiresCompanyObjectiveForSave } from "@/6-0-social-media-performance-shared/insightTargetSaveValidation";
import type { PlatformPeriodActuals } from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import { periodKeyToQueryFilter } from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import { socialMediaInsightQueryKeys } from "@/6-0-social-media-performance-shared/socialMediaInsightQueryKeys";
import type {
  InsightTargetAccountAssignment,
  InsightTargetAccountRef,
  InsightTargetFormValue,
  InsightTargetPeriodKey,
  SocialMediaInsightTargetRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { InsightOkrSyncResult } from "@/6-0-social-media-performance-shared/insightTargetOkrSync";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";

export type SaveInsightTargetsResult = {
  targets: SocialMediaInsightTargetRow[];
  okrSync: InsightOkrSyncResult;
};

type SaveArgs = {
  period: InsightTargetPeriodKey;
  values: InsightTargetFormValue[];
  assignments: InsightTargetAccountAssignment[];
  accountRefs: InsightTargetAccountRef[];
  accountActuals?: Map<string, PlatformPeriodActuals>;
  createdBy: string;
  companyObjectiveId: string | null;
};

async function savePeriodSettings(
  organizationId: string,
  period: InsightTargetPeriodKey,
  companyObjectiveId: string | null,
  syncedDepartmentObjectiveId: string | null = null,
): Promise<void> {
  const filter = periodKeyToQueryFilter(period);

  let findQuery = supabase
    .from("social_media_insight_target_period_settings")
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
        .from("social_media_insight_target_period_settings")
        .delete()
        .eq("id", existing.id);
      if (deleteError) throw deleteError;
    }
    return;
  }

  const payload = {
    company_objective_id: companyObjectiveId,
    synced_department_objective_id: syncedDepartmentObjectiveId,
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("social_media_insight_target_period_settings")
      .update(payload)
      .eq("id", existing.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from("social_media_insight_target_period_settings")
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

function targetRowKey(row: {
  platform: string;
  account_id: string;
  metric: string;
}): string {
  return `${row.platform}:${row.account_id}:${row.metric}`;
}

function desiredValueKey(v: InsightTargetFormValue): string {
  return `${v.platform}:${v.accountId}:${v.metric}`;
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
  period: InsightTargetPeriodKey,
  assignments: InsightTargetAccountAssignment[],
): Promise<void> {
  const filter = periodKeyToQueryFilter(period);

  let existingQuery = supabase
    .from("social_media_insight_target_assignments")
    .select("id, platform, account_id")
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
    assignments.map((a) => `${a.platform}:${a.accountId}`),
  );

  for (const row of existing ?? []) {
    const key = `${row.platform}:${row.account_id}`;
    if (!desiredKeys.has(key)) {
      const { error } = await supabase
        .from("social_media_insight_target_assignments")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
    }
  }

  for (const assignment of assignments) {
    let findQuery = supabase
      .from("social_media_insight_target_assignments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("platform", assignment.platform)
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
        .from("social_media_insight_target_assignments")
        .update({ employee_id: assignment.employeeId })
        .eq("id", found.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("social_media_insight_target_assignments")
        .insert({
          organization_id: organizationId,
          platform: assignment.platform,
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
  period: InsightTargetPeriodKey,
  values: InsightTargetFormValue[],
): Promise<SocialMediaInsightTargetRow[]> {
  const filter = periodKeyToQueryFilter(period);

  let existingQuery = supabase
    .from("social_media_insight_targets")
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

  const existingByKey = new Map<string, SocialMediaInsightTargetRow>();
  for (const row of (existingRows ?? []) as SocialMediaInsightTargetRow[]) {
    existingByKey.set(targetRowKey(row), row);
  }

  const desiredByKey = new Map<string, InsightTargetFormValue>();
  for (const v of values.filter((x) => x.targetValue > 0)) {
    desiredByKey.set(desiredValueKey(v), v);
  }

  for (const [key, row] of existingByKey) {
    if (!desiredByKey.has(key)) {
      await deleteIndividualObjectiveIfAny(row.individual_objective_id);
      const { error } = await supabase
        .from("social_media_insight_targets")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
    }
  }

  const saved: SocialMediaInsightTargetRow[] = [];

  for (const [, value] of desiredByKey) {
    const key = desiredValueKey(value);
    const existing = existingByKey.get(key);
    if (existing) {
      const { data, error } = await supabase
        .from("social_media_insight_targets")
        .update({ target_value: value.targetValue })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      saved.push(data as SocialMediaInsightTargetRow);
    } else {
      const { data, error } = await supabase
        .from("social_media_insight_targets")
        .insert({
          organization_id: organizationId,
          platform: value.platform,
          account_id: value.accountId,
          metric: value.metric,
          period_type: filter.period_type,
          year: filter.year,
          month: filter.period_type === "monthly" ? filter.month ?? null : null,
          quarter: filter.period_type === "quarterly" ? filter.quarter ?? null : null,
          target_value: value.targetValue,
        })
        .select()
        .single();
      if (error) throw error;
      saved.push(data as SocialMediaInsightTargetRow);
    }
  }

  return saved;
}

export function useSocialMediaInsightTargetsMutations() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const saveTargets = useMutation({
    mutationFn: async (args: SaveArgs): Promise<SaveInsightTargetsResult> => {
      if (!organizationId) throw new Error("Organization ID is required");

      const needsCompanyObjective = requiresCompanyObjectiveForSave(args.values, args.assignments);
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
      const resolvedCycle = resolveOkrCycleForInsightPeriod(args.period, resolvedCycles);

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
        departmentId = await resolveFirstPicDepartmentId(supabase, args.assignments);
        if (!departmentId) {
          throw new Error("PIC_DEPARTMENT_REQUIRED");
        }
      }

      await saveAssignments(organizationId, args.period, args.assignments);
      const targets = await saveTargetRows(organizationId, args.period, args.values);

      const actualsMap = args.accountActuals ?? new Map<string, PlatformPeriodActuals>();

      let okrSync: InsightOkrSyncResult = {
        syncedIndividualObjectiveCount: 0,
        skippedNoCycle: true,
        cycleId: null,
        syncedDepartmentObjectiveId: null,
      };

      if (needsCompanyObjective && args.companyObjectiveId && resolvedCycle && departmentId) {
        okrSync = await syncInsightTargetsToOkr({
          supabase,
          organizationId,
          period: args.period,
          createdBy: args.createdBy,
          cycles: resolvedCycles,
          accountRefs: args.accountRefs,
          accountActuals: actualsMap,
          companyObjectiveId: args.companyObjectiveId,
          departmentId,
        });

        await savePeriodSettings(
          organizationId,
          args.period,
          args.companyObjectiveId,
          okrSync.syncedDepartmentObjectiveId,
        );
      } else if (!needsCompanyObjective) {
        await savePeriodSettings(organizationId, args.period, null);
      }

      if (!okrSync.skippedNoCycle) {
        await syncInsightIndividualObjectiveProgress({
          supabase,
          organizationId,
          period: args.period,
          accounts: args.accountRefs,
          accountActuals: actualsMap,
        });
      }

      return { targets, okrSync };
    },
    onSuccess: (_data, variables) => {
      if (!organizationId) return;
      queryClient.invalidateQueries({
        queryKey: socialMediaInsightQueryKeys.targets(organizationId, variables.period),
      });
      queryClient.invalidateQueries({
        queryKey: socialMediaInsightQueryKeys.assignments(organizationId, variables.period),
      });
      queryClient.invalidateQueries({
        queryKey: socialMediaInsightQueryKeys.periodSettings(organizationId, variables.period),
      });
      queryClient.invalidateQueries({
        queryKey: socialMediaInsightQueryKeys.linkedIndividualObjectiveIds(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: socialMediaInsightQueryKeys.insightMetricsByObjective(organizationId),
      });
      queryClient.invalidateQueries({ queryKey: ["individual-objectives"] });
      queryClient.invalidateQueries({ queryKey: ["department-objectives"] });
      queryClient.invalidateQueries({ queryKey: ["company-objectives"] });
    },
  });

  return { saveTargets, upsertTargets: saveTargets };
}
