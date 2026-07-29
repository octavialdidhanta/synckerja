/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  linkedinContentJson,
  linkedinContentCorsHeaders,
  requireActiveOrg,
  requireOrgAdmin,
  requireLinkedInContentPlatformConfigured,
} from "../_shared/linkedinContentAuth.ts";
import { cancelScheduleById } from "../_shared/scheduledPosts/scheduledPostCancel.ts";
import { assertPlatformCanSchedule } from "../_shared/scheduledPosts/platformRegistry.ts";
import { runScheduledPostJob } from "../_shared/scheduledPosts/runScheduledPostJob.ts";
import { runPostNowInBackground } from "../_shared/scheduledPosts/schedulePostNowAsync.ts";
import { insertPlatformScheduleForTarget } from "../_shared/scheduledPosts/createPlatformScheduleRow.ts";
import {
  getPlanEligibilityMissingReasons,
  isPlanEligibleForLinkedInAutoSchedule,
} from "../_shared/scheduledPosts/scheduledPostEligibility.ts";

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

function mapScheduleInsertError(msg: string): { body: Record<string, unknown>; status: number } {
  if (msg === "publish_scopes_not_granted" || msg === "upload_scopes_not_granted") {
    return { body: { error: msg }, status: 403 };
  }
  if (msg === "linkedin_account_not_found") {
    return { body: { error: msg }, status: 404 };
  }
  if (msg === "invalid_scheduled_at" || msg === "invalid_target") {
    return { body: { error: msg }, status: 400 };
  }
  return { body: { error: "Failed to create schedule" }, status: 500 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: linkedinContentCorsHeaders });
  }
  if (req.method !== "POST") return linkedinContentJson({ error: "Method not allowed" }, 405);

  const platformForbidden = requireLinkedInContentPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return linkedinContentJson({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return linkedinContentJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return linkedinContentJson({ error: "Missing organization_id" }, 400);

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
    const ok = await cancelScheduleById(admin, scheduleId);
    return linkedinContentJson({ ok }, ok ? 200 : 400);
  }

  if (action === "execute") {
    if (!isInternalExecute) return linkedinContentJson({ error: "Forbidden" }, 403);
    const scheduleId = String(body.schedule_id ?? "").trim();
    const job = await runScheduledPostJob(admin, scheduleId);
    if (!job.ok) return linkedinContentJson({ error: job.error ?? "publish_failed" }, 500);
    return linkedinContentJson({
      ok: true,
      published_url: job.published_url,
      external_post_id: job.external_post_id,
    }, 200);
  }

  const planId = String(body.social_media_plan_id ?? "").trim();
  const plan = await loadPlanForPublish(admin, planId);
  if (!plan || plan.organization_id !== organizationId) {
    return linkedinContentJson({ error: "Plan not found" }, 404);
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
      assertPlatformCanSchedule("LinkedIn");
    } catch (e) {
      return linkedinContentJson({ error: e instanceof Error ? e.message : "platform_not_supported" }, 400);
    }

    if (!isPlanEligibleForLinkedInAutoSchedule(eligibility)) {
      return linkedinContentJson({
        error: "plan_not_eligible",
        missing: getPlanEligibilityMissingReasons(eligibility),
      }, 400);
    }

    const pageId = String(body.page_id ?? "").trim();
    if (!pageId) return linkedinContentJson({ error: "Missing page_id" }, 400);

    const scheduledAtRaw = action === "post_now"
      ? new Date().toISOString()
      : String(body.scheduled_at ?? "").trim();
    if (!scheduledAtRaw) return linkedinContentJson({ error: "Missing scheduled_at" }, 400);

    const driveLink = plan.google_drive_link?.trim() ?? "";

    let inserted;
    try {
      inserted = await insertPlatformScheduleForTarget(admin, {
        organizationId,
        planId,
        driveLink,
        caption: body.caption != null ? String(body.caption) : null,
        title: body.title != null ? String(body.title) : null,
        employeeId: body.employee_id != null ? String(body.employee_id) : null,
        userId,
        action: action as "schedule" | "post_now",
        scheduledAtIso: scheduledAtRaw,
        target: {
          platform: "LinkedIn",
          account_id: pageId,
          account_label: body.account_label != null ? String(body.account_label) : "",
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "schedule_insert_failed";
      const mapped = mapScheduleInsertError(msg);
      return linkedinContentJson(mapped.body, mapped.status);
    }

    if (action === "post_now") {
      const job = await runPostNowInBackground(admin, inserted.id);
      if ("processing" in job && job.processing) {
        return linkedinContentJson({
          ok: true,
          processing: true,
          schedule: inserted,
        }, 200);
      }
      if (!job.ok) return linkedinContentJson({ error: job.error ?? "publish_failed" }, 500);
      const { data: publishedRow } = await admin
        .from("social_media_scheduled_posts")
        .select("*")
        .eq("id", inserted.id)
        .maybeSingle();
      return linkedinContentJson({
        ok: true,
        schedule: publishedRow ?? inserted,
        published_url: job.published_url,
        external_post_id: job.external_post_id,
      }, 200);
    }

    return linkedinContentJson({ ok: true, schedule: inserted }, 200);
  }

  return linkedinContentJson({ error: "Unknown action" }, 400);
});
