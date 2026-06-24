import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ScheduleRow } from "./pickPlatformScheduleServer.ts";
import {
  computePlanDoneState,
  computeRequiredPlatformProgressItems,
  derivePlanPostMetadata,
  filterRequiredPlatformsForContentType,
  type RequiredPlatformRow,
  type SocialMediaLinkRow,
} from "./syncPlanDoneState.ts";
import { calculateOnTimeStatus } from "./syncPlanPostMetadata.ts";

export type SyncPlanCompletionResult = {
  done: boolean | null;
  actual_post_date: string | null;
  on_time_status: string;
};

async function loadPlanCompletionInputs(
  admin: SupabaseClient,
  planId: string,
): Promise<{
  plan: {
    id: string;
    service_id: string | null;
    done: boolean;
    post_date: string | null;
    actual_post_date: string | null;
    on_time_status: string | null;
    contentTypeName: string | null;
  };
  required: RequiredPlatformRow[];
  links: SocialMediaLinkRow[];
  schedules: ScheduleRow[];
} | null> {
  const { data: plan, error: planErr } = await admin
    .from("social_media_plans")
    .select("id, service_id, done, post_date, actual_post_date, on_time_status, content_type:content_types(name)")
    .eq("id", planId)
    .maybeSingle();

  if (planErr || !plan) {
    console.error("syncPlanCompletionStateForPlan plan:", planErr?.message);
    return null;
  }

  const contentTypeName = (plan as { content_type?: { name?: string } }).content_type?.name ?? null;
  const serviceId = (plan as { service_id?: string | null }).service_id;

  let required: RequiredPlatformRow[] = [];
  if (serviceId) {
    const { data: reqRows } = await admin
      .from("service_required_platforms")
      .select("id, platform, is_active, platform_account_id, platform_account_label, custom_platform_name")
      .eq("service_id", serviceId)
      .eq("is_active", true);
    required = (reqRows ?? []) as RequiredPlatformRow[];
  }

  const { data: links } = await admin
    .from("social_media_links")
    .select("platform, url, platform_account_open_id, created_at")
    .eq("social_media_plan_id", planId);

  const { data: scheduleRows } = await admin
    .from("social_media_scheduled_posts")
    .select("id, platform, status, created_at, published_at, provider_config, platform_account_id")
    .eq("social_media_plan_id", planId);

  return {
    plan: {
      id: String(plan.id),
      service_id: serviceId,
      done: Boolean((plan as { done?: boolean }).done),
      post_date: (plan as { post_date?: string | null }).post_date ?? null,
      actual_post_date: (plan as { actual_post_date?: string | null }).actual_post_date ?? null,
      on_time_status: (plan as { on_time_status?: string | null }).on_time_status ?? null,
      contentTypeName,
    },
    required,
    links: (links ?? []) as SocialMediaLinkRow[],
    schedules: (scheduleRows ?? []) as ScheduleRow[],
  };
}

export async function syncPlanCompletionStateForPlan(
  admin: SupabaseClient,
  planId: string,
): Promise<SyncPlanCompletionResult | null> {
  const inputs = await loadPlanCompletionInputs(admin, planId);
  if (!inputs) return null;

  const { plan, required, links, schedules } = inputs;
  const activeRequired = filterRequiredPlatformsForContentType(required, plan.contentTypeName);
  const hasRequiredPlatforms = activeRequired.length > 0;

  const done = computePlanDoneState(required, links, plan.contentTypeName, schedules);
  const items = computeRequiredPlatformProgressItems(
    required,
    links,
    plan.contentTypeName,
    schedules,
  );
  const metadata = derivePlanPostMetadata(
    items,
    links,
    plan.post_date,
    hasRequiredPlatforms,
    calculateOnTimeStatus,
  );

  const currentOnTime = String(plan.on_time_status ?? "").trim();
  const needsUpdate =
    plan.done !== done
    || plan.actual_post_date !== metadata.actual_post_date
    || currentOnTime !== metadata.on_time_status;

  if (!needsUpdate) {
    return { done, ...metadata };
  }

  const { error: updateErr } = await admin
    .from("social_media_plans")
    .update({
      done,
      actual_post_date: metadata.actual_post_date,
      on_time_status: metadata.on_time_status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  if (updateErr) {
    console.error("syncPlanCompletionStateForPlan update:", updateErr.message);
    return null;
  }

  return { done, ...metadata };
}

/** @deprecated Use syncPlanCompletionStateForPlan */
export async function syncPlanDoneStateForPlan(
  admin: SupabaseClient,
  planId: string,
): Promise<boolean | null> {
  const result = await syncPlanCompletionStateForPlan(admin, planId);
  return result?.done ?? null;
}

/** @deprecated Use syncPlanCompletionStateForPlan */
export async function syncPlanPostMetadataForPlan(
  admin: SupabaseClient,
  planId: string,
): Promise<{ actual_post_date: string | null; on_time_status: string } | null> {
  const result = await syncPlanCompletionStateForPlan(admin, planId);
  if (!result) return null;
  return {
    actual_post_date: result.actual_post_date,
    on_time_status: result.on_time_status,
  };
}
