import { fetchInsightPeriodActualsByAccount } from "@/6-0-social-media-performance-shared/fetchInsightPeriodActualsByAccount";
import { insightKeyResultProgress } from "@/6-0-social-media-performance-shared/insightTargetOkrProgress";
import {
  actualValueForMetric,
  type PlatformPeriodActuals,
} from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import type {
  InsightTargetAccountRef,
  InsightTargetPeriodKey,
  SocialMediaInsightTargetRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

function accountKey(platform: string, accountId: string): string {
  return `${platform}:${accountId}`;
}

export async function syncInsightIndividualObjectiveProgress(args: {
  supabase: SupabaseClient;
  organizationId: string;
  period: InsightTargetPeriodKey;
  accounts?: InsightTargetAccountRef[];
  accountActuals?: Map<string, PlatformPeriodActuals>;
}): Promise<number> {
  const filter = args.period.periodType === "monthly"
    ? { period_type: "monthly" as const, year: args.period.year, month: args.period.month }
    : { period_type: "quarterly" as const, year: args.period.year, quarter: args.period.quarter };

  let query = args.supabase
    .from("social_media_insight_targets")
    .select("*")
    .eq("organization_id", args.organizationId)
    .eq("period_type", filter.period_type)
    .eq("year", filter.year)
    .not("individual_objective_id", "is", null);

  if (filter.period_type === "monthly" && filter.month != null) {
    query = query.eq("month", filter.month);
  }
  if (filter.period_type === "quarterly" && filter.quarter != null) {
    query = query.eq("quarter", filter.quarter);
  }

  const { data: rows, error } = await query;
  if (error) throw error;

  const linked = (rows ?? []) as SocialMediaInsightTargetRow[];
  if (linked.length === 0) return 0;

  let actualsMap = args.accountActuals;
  if (!actualsMap && args.accounts && args.accounts.length > 0) {
    actualsMap = await fetchInsightPeriodActualsByAccount({
      organizationId: args.organizationId,
      period: args.period,
      accounts: args.accounts,
    });
  }
  if (!actualsMap) {
    actualsMap = new Map();
  }

  const deptObjectiveIds = new Set<string>();
  let updated = 0;

  for (const row of linked) {
    if (!row.individual_objective_id) continue;
    const targetValue = Number(row.target_value);
    if (targetValue <= 0) continue;

    const actuals = actualsMap.get(accountKey(row.platform, row.account_id));
    const actual = actuals != null ? actualValueForMetric(actuals, row.metric) : null;
    const progress = insightKeyResultProgress(row.metric, actual, targetValue);

    const { data: io, error: ioFetchError } = await args.supabase
      .from("individual_objectives")
      .select("department_objective_id")
      .eq("id", row.individual_objective_id)
      .maybeSingle();

    if (ioFetchError) {
      console.warn("[insightTargetOkrProgressSync] IO fetch failed:", ioFetchError);
      continue;
    }

    if (io?.department_objective_id) {
      deptObjectiveIds.add(io.department_objective_id as string);
    }

    const { error: updateError } = await args.supabase
      .from("individual_objectives")
      .update({ progress_percentage: progress })
      .eq("id", row.individual_objective_id);

    if (updateError) {
      console.warn("[insightTargetOkrProgressSync] IO update failed:", updateError);
      continue;
    }
    updated += 1;
  }

  for (const deptId of deptObjectiveIds) {
    const { data: children, error: childError } = await args.supabase
      .from("individual_objectives")
      .select("progress_percentage")
      .eq("department_objective_id", deptId)
      .eq("status", "active");

    if (childError || !children?.length) continue;

    const avg =
      children.reduce((sum, c) => sum + Number(c.progress_percentage ?? 0), 0) / children.length;

    await args.supabase
      .from("department_objectives")
      .update({ progress_percentage: Math.round(avg) })
      .eq("id", deptId);
  }

  return updated;
}

/** @deprecated Use syncInsightIndividualObjectiveProgress */
export const syncInsightKeyResultProgress = syncInsightIndividualObjectiveProgress;
