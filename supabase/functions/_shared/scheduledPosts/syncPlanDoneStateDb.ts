import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computePlanDoneState,
  type RequiredPlatformRow,
  type SocialMediaLinkRow,
} from "./syncPlanDoneState.ts";

export async function syncPlanDoneStateForPlan(
  admin: SupabaseClient,
  planId: string,
): Promise<boolean | null> {
  const { data: plan, error: planErr } = await admin
    .from("social_media_plans")
    .select("id, service_id, done, content_type:content_types(name)")
    .eq("id", planId)
    .maybeSingle();

  if (planErr || !plan) {
    console.error("syncPlanDoneStateForPlan plan:", planErr?.message);
    return null;
  }

  const contentTypeName = (plan as { content_type?: { name?: string } }).content_type?.name ?? null;
  const serviceId = (plan as { service_id?: string | null }).service_id;

  let required: RequiredPlatformRow[] = [];
  if (serviceId) {
    const { data: reqRows } = await admin
      .from("service_required_platforms")
      .select("platform, is_active")
      .eq("service_id", serviceId)
      .eq("is_active", true);
    required = (reqRows ?? []) as RequiredPlatformRow[];
  }

  const { data: links } = await admin
    .from("social_media_links")
    .select("platform, url")
    .eq("social_media_plan_id", planId);

  const done = computePlanDoneState(
    required,
    (links ?? []) as SocialMediaLinkRow[],
    contentTypeName,
  );

  const currentDone = Boolean((plan as { done?: boolean }).done);
  if (currentDone === done) return done;

  const { error: updateErr } = await admin
    .from("social_media_plans")
    .update({ done, updated_at: new Date().toISOString() })
    .eq("id", planId);

  if (updateErr) {
    console.error("syncPlanDoneStateForPlan update:", updateErr.message);
    return null;
  }

  return done;
}
