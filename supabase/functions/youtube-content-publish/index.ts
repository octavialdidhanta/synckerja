/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireOrgAdmin,
  requireYouTubeContentPlatformConfigured,
  youtubeContentCorsHeaders,
  youtubeContentJson,
  youtubeContentScopesIncludeUpload,
  parseYouTubeOAuthScopes,
} from "../_shared/youtubeContentAuth.ts";
import { youtubeContentScopesIncludeDelete } from "../_shared/youtubeContent/youtubeContentDeleteScopes.ts";
import { deleteYouTubePublishedPost } from "../_shared/scheduledPosts/deletePublished/deleteYouTubePublishedPost.ts";
import { cancelScheduleById, cancelPendingSchedulesForPlatformAccount } from "../_shared/scheduledPosts/scheduledPostCancel.ts";
import { assertPlatformCanSchedule } from "../_shared/scheduledPosts/platformRegistry.ts";
import { runScheduledPostJob } from "../_shared/scheduledPosts/runScheduledPostJob.ts";
import {
  getPlanEligibilityMissingReasons,
  isPlanEligibleForYouTubeAutoSchedule,
} from "../_shared/scheduledPosts/scheduledPostEligibility.ts";
import {
  DEFAULT_YOUTUBE_SCHEDULE_PRIVACY,
  normalizeYouTubeSchedulePrivacy,
} from "../_shared/scheduledPosts/normalizeYouTubeSchedulePrivacy.ts";
import { DEFAULT_TIMEZONE } from "../_shared/scheduledPosts/scheduledPostTypes.ts";
import type { YouTubeProviderConfig } from "../_shared/scheduledPosts/scheduledPostTypes.ts";

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
    return new Response("ok", { status: 200, headers: youtubeContentCorsHeaders });
  }
  if (req.method !== "POST") {
    return youtubeContentJson({ error: "Method not allowed" }, 405);
  }

  const platformForbidden = requireYouTubeContentPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return youtubeContentJson({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return youtubeContentJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return youtubeContentJson({ error: "Missing organization_id" }, 400);

  const isInternalExecute = action === "execute" &&
    body.internal_secret === Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET");

  let userId: string | null = null;
  if (!isInternalExecute) {
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;
    userId = userRes.userId;
    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;
    const adminForbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
    if (adminForbidden) return adminForbidden;
  }

  if (action === "cancel") {
    const scheduleId = String(body.schedule_id ?? "").trim();
    if (!scheduleId) return youtubeContentJson({ error: "Missing schedule_id" }, 400);
    const ok = await cancelScheduleById(admin, scheduleId);
    return youtubeContentJson({ ok }, ok ? 200 : 400);
  }

  if (action === "execute") {
    if (!isInternalExecute) return youtubeContentJson({ error: "Forbidden" }, 403);
    const scheduleId = String(body.schedule_id ?? "").trim();
    if (!scheduleId) return youtubeContentJson({ error: "Missing schedule_id" }, 400);
    const job = await runScheduledPostJob(admin, scheduleId);
    if (!job.ok) {
      return youtubeContentJson(
        { error: job.error ?? "publish_failed", retry_count: job.retry_count, stub_code: job.stubCode },
        job.error === "Schedule not found" ? 404 : 500,
      );
    }
    return youtubeContentJson({
      ok: true,
      published_url: job.published_url,
      external_post_id: job.external_post_id,
    }, 200);
  }

  if (action === "delete") {
    const planId = String(body.social_media_plan_id ?? "").trim();
    const channelId = String(body.channel_id ?? "").trim();
    if (!planId) return youtubeContentJson({ error: "Missing social_media_plan_id" }, 400);
    if (!channelId) return youtubeContentJson({ error: "Missing channel_id" }, 400);

    const { data: tokenRow } = await admin
      .from("organization_youtube_content_connection_tokens")
      .select("oauth_scopes")
      .eq("organization_id", organizationId)
      .eq("channel_id", channelId)
      .maybeSingle();

    if (!youtubeContentScopesIncludeDelete(parseYouTubeOAuthScopes(tokenRow?.oauth_scopes))) {
      return youtubeContentJson({ error: "delete_scopes_not_granted" }, 403);
    }

    const result = await deleteYouTubePublishedPost(admin, {
      organizationId,
      planId,
      channelId,
    });

    if (!result.ok) {
      const status = result.error === "plan_not_found" ? 404 : 500;
      return youtubeContentJson({ error: result.error }, status);
    }

    return youtubeContentJson({
      ok: true,
      already_deleted: result.already_deleted,
      nothing_to_delete_on_platform: result.nothing_to_delete_on_platform,
      cleanup: result.cleanup,
    }, 200);
  }

  const planId = String(body.social_media_plan_id ?? "").trim();
  if (!planId) return youtubeContentJson({ error: "Missing social_media_plan_id" }, 400);

  const plan = await loadPlanForPublish(admin, planId);
  if (!plan || plan.organization_id !== organizationId) {
    return youtubeContentJson({ error: "Plan not found" }, 404);
  }

  const eligibility = {
    post_date: plan.post_date,
    approved: plan.approved,
    production_approved: plan.production_approved,
    google_drive_link: plan.google_drive_link,
    content_type_name: plan.content_type?.name ?? null,
  };

  if (action === "schedule" || action === "post_now") {
    try {
      assertPlatformCanSchedule("YouTube");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "platform_not_supported";
      return youtubeContentJson({ error: msg }, 400);
    }

    if (!isPlanEligibleForYouTubeAutoSchedule(eligibility)) {
      return youtubeContentJson({
        error: "plan_not_eligible",
        missing: getPlanEligibilityMissingReasons(eligibility),
      }, 400);
    }

    const channelId = String(body.channel_id ?? "").trim();
    if (!channelId) return youtubeContentJson({ error: "Missing channel_id" }, 400);

    const { data: tokenRow } = await admin
      .from("organization_youtube_content_connection_tokens")
      .select("oauth_scopes")
      .eq("organization_id", organizationId)
      .eq("channel_id", channelId)
      .maybeSingle();

    if (!youtubeContentScopesIncludeUpload(parseYouTubeOAuthScopes(tokenRow?.oauth_scopes))) {
      return youtubeContentJson({ error: "upload_scopes_not_granted" }, 403);
    }

    const scheduledAtRaw = action === "post_now"
      ? new Date().toISOString()
      : String(body.scheduled_at ?? "").trim();
    if (!scheduledAtRaw) return youtubeContentJson({ error: "Missing scheduled_at" }, 400);

    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      return youtubeContentJson({ error: "Invalid scheduled_at" }, 400);
    }

    const caption = body.caption != null ? String(body.caption) : null;
    const title = body.title != null ? String(body.title) : null;
    const accountLabel = body.account_label != null ? String(body.account_label) : "";
    const driveLink = plan.google_drive_link?.trim() ?? "";

    await cancelPendingSchedulesForPlatformAccount(admin, planId, "YouTube", channelId);

    const providerConfig: YouTubeProviderConfig = {
      channel_id: channelId,
      account_label: accountLabel,
      ...(body.employee_id ? { employee_id: String(body.employee_id) } : {}),
    };

    if (body.privacy_level != null && !normalizeYouTubeSchedulePrivacy(body.privacy_level)) {
      return youtubeContentJson({ error: "invalid_privacy_level" }, 400);
    }

    const privacyLevel =
      normalizeYouTubeSchedulePrivacy(body.privacy_level) ?? DEFAULT_YOUTUBE_SCHEDULE_PRIVACY;

    const { data: inserted, error: insertErr } = await admin
      .from("social_media_scheduled_posts")
      .insert({
        organization_id: organizationId,
        social_media_plan_id: planId,
        platform: "YouTube",
        delivery_mode: "api_auto",
        status: action === "post_now" ? "publishing" : "pending",
        scheduled_at: scheduledAt.toISOString(),
        timezone: DEFAULT_TIMEZONE,
        media_source: "google_drive_link",
        media_url_snapshot: driveLink,
        caption,
        title,
        privacy_level: privacyLevel,
        provider_config: providerConfig,
        platform_account_id: channelId,
        scheduled_by: userId,
      })
      .select("*")
      .single();

    if (insertErr || !inserted) {
      console.error("youtube schedule insert:", insertErr?.message);
      return youtubeContentJson({ error: "Failed to create schedule" }, 500);
    }

    if (action === "post_now") {
      const job = await runScheduledPostJob(admin, inserted.id, { skipPublishingTransition: true });
      if (!job.ok) {
        return youtubeContentJson(
          { error: job.error ?? "publish_failed", stub_code: job.stubCode },
          500,
        );
      }

      const { data: publishedRow } = await admin
        .from("social_media_scheduled_posts")
        .select("*")
        .eq("id", inserted.id)
        .maybeSingle();

      return youtubeContentJson({
        ok: true,
        schedule: publishedRow ?? inserted,
        published_url: job.published_url,
        external_post_id: job.external_post_id,
      }, 200);
    }

    return youtubeContentJson({ ok: true, schedule: inserted }, 200);
  }

  return youtubeContentJson({ error: "Unknown action" }, 400);
});
