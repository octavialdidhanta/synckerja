/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  metaContentCorsHeaders,
  metaContentJson,
  requireActiveOrg,
  resolveMetaContentAccount,
} from "../_shared/metaContentAuth.ts";
import { cancelScheduleById, cancelPendingSchedulesForPlatformAccount } from "../_shared/scheduledPosts/scheduledPostCancel.ts";
import { assertPlatformCanSchedule } from "../_shared/scheduledPosts/platformRegistry.ts";
import { runScheduledPostJob } from "../_shared/scheduledPosts/runScheduledPostJob.ts";
import {
  getPlanEligibilityMissingReasons,
  isPlanEligibleForInstagramAutoSchedule,
} from "../_shared/scheduledPosts/scheduledPostEligibility.ts";
import { DEFAULT_PRIVACY_LEVEL, DEFAULT_TIMEZONE } from "../_shared/scheduledPosts/scheduledPostTypes.ts";
import type { InstagramProviderConfig } from "../_shared/scheduledPosts/scheduledPostTypes.ts";

const PUBLISH_SCOPES = ["instagram_content_publish"];

async function loadPlanForPublish(admin: ReturnType<typeof createClient>, planId: string) {
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
    return new Response("ok", { status: 200, headers: metaContentCorsHeaders });
  }
  if (req.method !== "POST") return metaContentJson({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return metaContentJson({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return metaContentJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return metaContentJson({ error: "Missing organization_id" }, 400);

  const isInternalExecute = action === "execute" &&
    body.internal_secret === Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET");

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
    if (!scheduleId) return metaContentJson({ error: "Missing schedule_id" }, 400);
    const ok = await cancelScheduleById(admin, scheduleId);
    return metaContentJson({ ok }, ok ? 200 : 400);
  }

  if (action === "execute") {
    if (!isInternalExecute) return metaContentJson({ error: "Forbidden" }, 403);
    const scheduleId = String(body.schedule_id ?? "").trim();
    const job = await runScheduledPostJob(admin, scheduleId);
    if (!job.ok) {
      return metaContentJson({ error: job.error ?? "publish_failed" }, 500);
    }
    return metaContentJson({
      ok: true,
      published_url: job.published_url,
      external_post_id: job.external_post_id,
    }, 200);
  }

  const planId = String(body.social_media_plan_id ?? "").trim();
  if (!planId) return metaContentJson({ error: "Missing social_media_plan_id" }, 400);
  const plan = await loadPlanForPublish(admin, planId);
  if (!plan || plan.organization_id !== organizationId) {
    return metaContentJson({ error: "Plan not found" }, 404);
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
      assertPlatformCanSchedule("Instagram");
    } catch (e) {
      return metaContentJson({ error: e instanceof Error ? e.message : "platform_not_supported" }, 400);
    }

    if (!isPlanEligibleForInstagramAutoSchedule(eligibility)) {
      return metaContentJson({
        error: "plan_not_eligible",
        missing: getPlanEligibilityMissingReasons(eligibility),
      }, 400);
    }

    const instagramBusinessAccountId = String(body.instagram_business_account_id ?? "").trim();
    if (!instagramBusinessAccountId) {
      return metaContentJson({ error: "Missing instagram_business_account_id" }, 400);
    }

    const account = await resolveMetaContentAccount(
      admin,
      organizationId,
      "instagram",
      instagramBusinessAccountId,
    );
    if (!account) return metaContentJson({ error: "instagram_account_not_found" }, 404);

    const grantedSet = new Set(account.grantedScopes.map((s) => s.toLowerCase()));
    if (!PUBLISH_SCOPES.every((s) => grantedSet.has(s))) {
      return metaContentJson({ error: "publish_scopes_not_granted" }, 403);
    }

    const scheduledAtRaw = action === "post_now"
      ? new Date().toISOString()
      : String(body.scheduled_at ?? "").trim();
    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      return metaContentJson({ error: "Invalid scheduled_at" }, 400);
    }

    const driveLink = plan.google_drive_link?.trim() ?? "";
    await cancelPendingSchedulesForPlatformAccount(
      admin,
      planId,
      "Instagram",
      instagramBusinessAccountId,
    );

    const providerConfig: InstagramProviderConfig = {
      instagram_business_account_id: instagramBusinessAccountId,
      facebook_page_id: account.pageId,
      account_label: body.account_label != null ? String(body.account_label) : account.accountLabel,
      ...(body.employee_id ? { employee_id: String(body.employee_id) } : {}),
    };

    const { data: inserted, error: insertErr } = await admin
      .from("social_media_scheduled_posts")
      .insert({
        organization_id: organizationId,
        social_media_plan_id: planId,
        platform: "Instagram",
        delivery_mode: "api_auto",
        status: action === "post_now" ? "publishing" : "pending",
        scheduled_at: scheduledAt.toISOString(),
        timezone: DEFAULT_TIMEZONE,
        media_source: "google_drive_link",
        media_url_snapshot: driveLink,
        caption: body.caption != null ? String(body.caption) : null,
        title: body.title != null ? String(body.title) : null,
        privacy_level: DEFAULT_PRIVACY_LEVEL,
        provider_config: providerConfig,
        platform_account_id: instagramBusinessAccountId,
        scheduled_by: userId,
      })
      .select("*")
      .single();

    if (insertErr || !inserted) {
      return metaContentJson({ error: "Failed to create schedule" }, 500);
    }

    if (action === "post_now") {
      const job = await runScheduledPostJob(admin, inserted.id, { skipPublishingTransition: true });
      if (!job.ok) return metaContentJson({ error: job.error ?? "publish_failed" }, 500);
      const { data: publishedRow } = await admin
        .from("social_media_scheduled_posts")
        .select("*")
        .eq("id", inserted.id)
        .maybeSingle();
      return metaContentJson({
        ok: true,
        schedule: publishedRow ?? inserted,
        published_url: job.published_url,
        external_post_id: job.external_post_id,
      }, 200);
    }

    return metaContentJson({ ok: true, schedule: inserted }, 200);
  }

  return metaContentJson({ error: "Unknown action" }, 400);
});
