import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PlanMetricRow = {
  plan_id?: string | null;
  view_count?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  share_count?: number | null;
};

function count(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

export async function upsertContentPlanPostMetrics(
  admin: SupabaseClient,
  organizationId: string,
  platform: "tiktok" | "instagram",
  rows: PlanMetricRow[],
): Promise<void> {
  const byPlan = new Map<string, { views: number; likes: number; comments: number; shares: number }>();
  for (const row of rows) {
    const planId = String(row.plan_id ?? "").trim();
    if (!planId) continue;
    const next = {
      views: count(row.view_count),
      likes: count(row.like_count),
      comments: count(row.comment_count),
      shares: count(row.share_count),
    };
    const current = byPlan.get(planId);
    if (!current || next.views >= current.views) byPlan.set(planId, next);
  }
  const planIds = [...byPlan.keys()];
  if (planIds.length === 0) return;

  const { data: plans, error: planError } = await admin
    .from("social_media_plans")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", planIds);
  if (planError) throw planError;
  const allowed = new Set((plans ?? []).map((plan) => String((plan as { id: string }).id)));
  const payload = [...byPlan.entries()]
    .filter(([planId]) => allowed.has(planId))
    .map(([planId, metric]) => ({
      organization_id: organizationId,
      plan_id: planId,
      platform,
      views: metric.views,
      likes: metric.likes,
      comments: metric.comments,
      shares: metric.shares,
      fetched_at: new Date().toISOString(),
    }));
  if (payload.length === 0) return;
  const { error } = await admin
    .from("content_plan_post_metrics")
    .upsert(payload, { onConflict: "plan_id,platform" });
  if (error) throw error;
}
