import { actualValueForAccount } from "@/6-0-digital-marketing-shared/googleAdsReportTargetActuals";
import { googleAdsKeyResultProgress } from "@/6-0-digital-marketing-shared/googleAdsReportTargetOkrProgress";
import type {
  GoogleAdsAccountPeriodActuals,
  GoogleAdsReportTargetPeriodKey,
  GoogleAdsReportTargetRow,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import type { MetricValueKind } from "@/google-ads/metrics/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncGoogleAdsIndividualObjectiveProgress(args: {
  supabase: SupabaseClient;
  organizationId: string;
  period: GoogleAdsReportTargetPeriodKey;
  accountActuals?: Map<string, GoogleAdsAccountPeriodActuals>;
  metricValueKinds: Record<string, MetricValueKind>;
}): Promise<number> {
  const filter =
    args.period.periodType === "monthly"
      ? { period_type: "monthly" as const, year: args.period.year, month: args.period.month }
      : { period_type: "quarterly" as const, year: args.period.year, quarter: args.period.quarter };

  let query = args.supabase
    .from("google_ads_report_targets")
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

  const linked = (rows ?? []) as GoogleAdsReportTargetRow[];
  if (linked.length === 0) return 0;

  const actualsMap = args.accountActuals ?? new Map<string, GoogleAdsAccountPeriodActuals>();
  const deptObjectiveIds = new Set<string>();
  let updated = 0;

  for (const row of linked) {
    if (!row.individual_objective_id) continue;
    const targetValue = Number(row.target_value);
    if (targetValue <= 0) continue;

    const actuals = actualsMap.get(row.google_customer_id);
    const actual =
      actuals != null ? actualValueForAccount(actuals, row.metric_key) : null;
    const valueKind = args.metricValueKinds[row.metric_key] ?? "count";
    const progress = googleAdsKeyResultProgress(
      row.metric_key,
      valueKind,
      actual,
      targetValue,
    );

    const { data: io, error: ioFetchError } = await args.supabase
      .from("individual_objectives")
      .select("department_objective_id")
      .eq("id", row.individual_objective_id)
      .maybeSingle();

    if (ioFetchError) {
      console.warn("[googleAdsReportTargetOkrProgressSync] IO fetch failed:", ioFetchError);
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
      console.warn("[googleAdsReportTargetOkrProgressSync] IO update failed:", updateError);
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

    if (childError) continue;
    if (!children || children.length === 0) continue;

    const avg =
      children.reduce((sum, c) => sum + Number(c.progress_percentage ?? 0), 0) / children.length;

    await args.supabase
      .from("department_objectives")
      .update({ progress_percentage: Math.round(avg) })
      .eq("id", deptId);
  }

  return updated;
}
