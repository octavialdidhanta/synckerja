/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireTikTokContentPlatformConfigured,
  tiktokContentCorsHeaders,
  tiktokContentJson,
  tiktokContentScopesIncludePublish,
} from "../_shared/tiktokContentAuth.ts";
import { cancelScheduleById } from "../_shared/scheduledPosts/scheduledPostCancel.ts";
import { executeTikTokScheduledPost } from "../_shared/scheduledPosts/executeTikTokScheduledPost.ts";
import { resolveScheduleStatusAfterFailure } from "../_shared/scheduledPosts/scheduledPostRetry.ts";
import {
  getPlanEligibilityMissingReasons,
  isPlanEligibleForTikTokAutoSchedule,
} from "../_shared/scheduledPosts/scheduledPostEligibility.ts";
import { DEFAULT_PRIVACY_LEVEL, DEFAULT_TIMEZONE } from "../_shared/scheduledPosts/scheduledPostTypes.ts";
import type { TikTokProviderConfig } from "../_shared/scheduledPosts/scheduledPostTypes.ts";

async function loadPlanForPublish(
  admin: ReturnType<typeof createClient>,
  planId: string,
) {
  const { data, error } = await admin
    .from("social_media_plans")
    .select(
      "id, organization_id, post_date, approved, production_approved, google_drive_link, content_type:content_types(name)",
    )
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    id: string;
    organization_id: string;
    post_date: string | null;
    approved: boolean;
    production_approved: boolean;
    google_drive_link: string | null;
    content_type?: { name?: string } | null;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: tiktokContentCorsHeaders });
  }
  if (req.method !== "POST") {
    return tiktokContentJson({ error: "Method not allowed" }, 405);
  }

  const platformForbidden = requireTikTokContentPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return tiktokContentJson({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return tiktokContentJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return tiktokContentJson({ error: "Missing organization_id" }, 400);

  const isInternalExecute = action === "execute" && body.internal_secret === Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET");

  let userId: string | null = null;
  if (!isInternalExecute) {
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;
    userId = userRes.userId;
    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;
  }

  if (action === "cancel") {
    const scheduleId = String(body.schedule_id ?? "").trim();
    if (!scheduleId) return tiktokContentJson({ error: "Missing schedule_id" }, 400);
    const ok = await cancelScheduleById(admin, scheduleId);
    return tiktokContentJson({ ok }, ok ? 200 : 400);
  }

  if (action === "execute") {
    if (!isInternalExecute) {
      return tiktokContentJson({ error: "Forbidden" }, 403);
    }
    const scheduleId = String(body.schedule_id ?? "").trim();
    if (!scheduleId) return tiktokContentJson({ error: "Missing schedule_id" }, 400);

    const { data: schedule, error: schedErr } = await admin
      .from("social_media_scheduled_posts")
      .select("*")
      .eq("id", scheduleId)
      .maybeSingle();

    if (schedErr || !schedule) return tiktokContentJson({ error: "Schedule not found" }, 404);
    if (schedule.status !== "pending" && schedule.status !== "publishing") {
      return tiktokContentJson({ error: "Schedule not runnable", status: schedule.status }, 400);
    }

    await admin
      .from("social_media_scheduled_posts")
      .update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("id", scheduleId);

    try {
      const result = await executeTikTokScheduledPost(admin, schedule);
      await admin
        .from("social_media_scheduled_posts")
        .update({
          status: "published",
          published_url: result.published_url,
          external_post_id: result.external_post_id,
          published_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", scheduleId);
      return tiktokContentJson({ ok: true, ...result }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "publish_failed";
      const retryCount = Number(schedule.retry_count ?? 0) + 1;
      const nextStatus = resolveScheduleStatusAfterFailure(retryCount, msg);
      await admin
        .from("social_media_scheduled_posts")
        .update({
          status: nextStatus,
          error_message: msg,
          retry_count: retryCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", scheduleId);
      return tiktokContentJson({ error: msg, retry_count: retryCount }, 500);
    }
  }

  const planId = String(body.social_media_plan_id ?? "").trim();
  if (!planId) return tiktokContentJson({ error: "Missing social_media_plan_id" }, 400);

  const plan = await loadPlanForPublish(admin, planId);
  if (!plan || plan.organization_id !== organizationId) {
    return tiktokContentJson({ error: "Plan not found" }, 404);
  }

  const eligibility = {
    post_date: plan.post_date,
    approved: plan.approved,
    production_approved: plan.production_approved,
    google_drive_link: plan.google_drive_link,
    content_type_name: plan.content_type?.name ?? null,
  };

  if (action === "schedule" || action === "post_now") {
    if (!isPlanEligibleForTikTokAutoSchedule(eligibility)) {
      return tiktokContentJson({
        error: "plan_not_eligible",
        missing: getPlanEligibilityMissingReasons(eligibility),
      }, 400);
    }

    const openId = String(body.open_id ?? "").trim();
    if (!openId) return tiktokContentJson({ error: "Missing open_id" }, 400);

    const { data: tokenRow } = await admin
      .from("organization_tiktok_content_connection_tokens")
      .select("oauth_scopes, publish_oauth_scopes, publish_access_token_enc")
      .eq("organization_id", organizationId)
      .eq("open_id", openId)
      .maybeSingle();

    const scopeForPublish = (tokenRow?.publish_oauth_scopes as string | null) ??
      (tokenRow?.oauth_scopes as string | null);
    const hasPublishToken = Boolean(tokenRow?.publish_access_token_enc);

    if (!hasPublishToken) {
      return tiktokContentJson({
        error: "publish_login_kit_token_missing",
        message: "Authorize TikTok publishing in Digital Marketing settings",
      }, 403);
    }

    if (!tiktokContentScopesIncludePublish(scopeForPublish)) {
      return tiktokContentJson({ error: "publish_scopes_not_granted" }, 403);
    }

    const scheduledAtRaw = action === "post_now"
      ? new Date().toISOString()
      : String(body.scheduled_at ?? "").trim();
    if (!scheduledAtRaw) return tiktokContentJson({ error: "Missing scheduled_at" }, 400);

    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      return tiktokContentJson({ error: "Invalid scheduled_at" }, 400);
    }

    const caption = body.caption != null ? String(body.caption) : null;
    const title = body.title != null ? String(body.title) : null;
    const accountLabel = body.account_label != null ? String(body.account_label) : "";
    const driveLink = plan.google_drive_link?.trim() ?? "";

    await admin
      .from("social_media_scheduled_posts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("social_media_plan_id", planId)
      .eq("platform", "TikTok")
      .in("status", ["pending", "publishing"]);

    const providerConfig: TikTokProviderConfig & { employee_id?: string } = {
      open_id: openId,
      account_label: accountLabel,
      ...(body.employee_id ? { employee_id: String(body.employee_id) } : {}),
    };

    const { data: inserted, error: insertErr } = await admin
      .from("social_media_scheduled_posts")
      .insert({
        organization_id: organizationId,
        social_media_plan_id: planId,
        platform: "TikTok",
        delivery_mode: "api_auto",
        status: action === "post_now" ? "publishing" : "pending",
        scheduled_at: scheduledAt.toISOString(),
        timezone: DEFAULT_TIMEZONE,
        media_source: "google_drive_link",
        media_url_snapshot: driveLink,
        caption,
        title,
        privacy_level: DEFAULT_PRIVACY_LEVEL,
        provider_config: providerConfig,
        scheduled_by: userId,
      })
      .select("*")
      .single();

    if (insertErr || !inserted) {
      console.error("schedule insert:", insertErr?.message);
      return tiktokContentJson({ error: "Failed to create schedule" }, 500);
    }

    if (action === "post_now") {
      try {
        const result = await executeTikTokScheduledPost(admin, inserted);
        await admin
          .from("social_media_scheduled_posts")
          .update({
            status: "published",
            published_url: result.published_url,
            external_post_id: result.external_post_id,
            published_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inserted.id);
        return tiktokContentJson({ ok: true, schedule: inserted, ...result }, 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "publish_failed";
        await admin
          .from("social_media_scheduled_posts")
          .update({
            status: "failed",
            error_message: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inserted.id);
        return tiktokContentJson({ error: msg }, 500);
      }
    }

    return tiktokContentJson({ ok: true, schedule: inserted }, 200);
  }

  return tiktokContentJson({ error: "Unknown action" }, 400);
});
