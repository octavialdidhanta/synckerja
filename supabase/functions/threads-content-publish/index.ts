/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  threadsContentCorsHeaders,
  threadsContentJson,
} from "../_shared/threadsContentAuth.ts";
import { cancelScheduleById } from "../_shared/scheduledPosts/scheduledPostCancel.ts";
import { deleteThreadsPublishedPost } from "../_shared/scheduledPosts/deletePublished/deleteThreadsPublishedPost.ts";
import { assertPlatformCanSchedule } from "../_shared/scheduledPosts/platformRegistry.ts";
import { runScheduledPostJob } from "../_shared/scheduledPosts/runScheduledPostJob.ts";
import { runPostNowInBackground } from "../_shared/scheduledPosts/schedulePostNowAsync.ts";
import { insertPlatformScheduleForTarget } from "../_shared/scheduledPosts/createPlatformScheduleRow.ts";
import {
  isActiveOrganizationMember,
  mcpScheduleUserId,
} from "../_shared/scheduledPosts/scheduledPostsInternalAuth.ts";
import {
  carouselMediaSnapshot,
  loadCarouselStoragePaths,
} from "../_shared/scheduledPosts/carouselImagePaths.ts";
import {
  getThreadsPlanEligibilityMissingReasons,
  isCarouselContentType,
  isPlanEligibleForThreadsAutoSchedule,
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
  if (msg === "threads_account_not_found") return { body: { error: msg }, status: 404 };
  if (msg === "invalid_scheduled_at" || msg === "invalid_target") {
    return { body: { error: msg }, status: 400 };
  }
  if (msg === "already_publishing") return { body: { error: msg }, status: 409 };
  return { body: { error: "Failed to create schedule" }, status: 500 };
}

async function handlePostNowResponse(
  admin: ReturnType<typeof createClient>,
  inserted: { id: string },
) {
  const job = await runPostNowInBackground(admin, inserted.id);
  if ("processing" in job && job.processing) {
    return threadsContentJson({ ok: true, processing: true, schedule: inserted }, 200);
  }
  if (!job.ok) return threadsContentJson({ error: job.error ?? "publish_failed" }, 500);
  const { data: publishedRow } = await admin
    .from("social_media_scheduled_posts")
    .select("*")
    .eq("id", inserted.id)
    .maybeSingle();
  return threadsContentJson({
    ok: true,
    schedule: publishedRow ?? inserted,
    published_url: job.published_url,
    external_post_id: job.external_post_id,
  }, 200);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: threadsContentCorsHeaders });
  }
  if (req.method !== "POST") return threadsContentJson({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return threadsContentJson({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return threadsContentJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return threadsContentJson({ error: "Missing organization_id" }, 400);

  const isInternalExecute = action === "execute" &&
    body.internal_secret === Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET");
  const mcpUserId = mcpScheduleUserId(action, body);

  let userId: string | null = null;
  if (mcpUserId) {
    const member = await isActiveOrganizationMember(admin, mcpUserId, organizationId);
    if (!member) return threadsContentJson({ error: "Forbidden" }, 403);
    userId = mcpUserId;
  } else if (!isInternalExecute) {
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;
    userId = userRes.userId;
    const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
    if (orgForbidden) return orgForbidden;
  }

  if (action === "cancel") {
    const scheduleId = String(body.schedule_id ?? "").trim();
    if (!scheduleId) return threadsContentJson({ error: "Missing schedule_id" }, 400);
    const ok = await cancelScheduleById(admin, scheduleId);
    return threadsContentJson({ ok }, ok ? 200 : 400);
  }

  if (action === "execute") {
    if (!isInternalExecute) return threadsContentJson({ error: "Forbidden" }, 403);
    const scheduleId = String(body.schedule_id ?? "").trim();
    const job = await runScheduledPostJob(admin, scheduleId);
    if (!job.ok) return threadsContentJson({ error: job.error ?? "publish_failed" }, 500);
    return threadsContentJson({
      ok: true,
      published_url: job.published_url,
      external_post_id: job.external_post_id,
    }, 200);
  }

  const planId = String(body.social_media_plan_id ?? "").trim();
  if (!planId) return threadsContentJson({ error: "Missing social_media_plan_id" }, 400);

  if (action === "delete") {
    if (!userId) return threadsContentJson({ error: "Forbidden" }, 403);
    const threadsUserId = String(body.threads_user_id ?? "").trim();
    if (!threadsUserId) return threadsContentJson({ error: "Missing threads_user_id" }, 400);
    const result = await deleteThreadsPublishedPost(admin, {
      organizationId,
      planId,
      threadsUserId,
    });
    if (!result.ok) {
      const status = result.error === "plan_not_found" || result.error === "threads_account_not_found" ? 404 : 400;
      return threadsContentJson({ error: result.error }, status);
    }
    return threadsContentJson(result, 200);
  }

  const plan = await loadPlanForPublish(admin, planId);
  if (!plan || plan.organization_id !== organizationId) {
    return threadsContentJson({ error: "Plan not found" }, 404);
  }

  const contentTypeName = plan.content_type?.name ?? null;
  const carousel = isCarouselContentType(contentTypeName);
  const carouselPaths = carousel ? await loadCarouselStoragePaths(admin, planId) : [];
  const eligibility = {
    post_date: plan.post_date,
    approved: plan.approved,
    production_approved: plan.production_approved,
    google_drive_link: plan.google_drive_link,
    content_type_name: contentTypeName,
    carousel_image_count: carouselPaths.length,
  };

  if (action === "schedule" || action === "post_now") {
    try {
      assertPlatformCanSchedule("Threads");
    } catch (error) {
      const message = error instanceof Error ? error.message : "platform_not_supported";
      return threadsContentJson({ error: message }, 400);
    }

    if (!isPlanEligibleForThreadsAutoSchedule(eligibility)) {
      return threadsContentJson({
        error: "plan_not_eligible",
        missing: getThreadsPlanEligibilityMissingReasons(eligibility),
      }, 400);
    }

    const threadsUserId = String(body.threads_user_id ?? "").trim();
    if (!threadsUserId) return threadsContentJson({ error: "Missing threads_user_id" }, 400);

    const scheduledAtRaw = action === "post_now"
      ? new Date().toISOString()
      : String(body.scheduled_at ?? "").trim();
    if (!scheduledAtRaw) return threadsContentJson({ error: "Missing scheduled_at" }, 400);

    let inserted;
    try {
      inserted = await insertPlatformScheduleForTarget(admin, {
        organizationId,
        planId,
        driveLink: carousel
          ? carouselMediaSnapshot(carouselPaths)
          : String(plan.google_drive_link ?? ""),
        caption: body.caption != null ? String(body.caption) : null,
        title: body.title != null ? String(body.title) : null,
        employeeId: body.employee_id != null ? String(body.employee_id) : null,
        userId,
        action: action as "schedule" | "post_now",
        scheduledAtIso: scheduledAtRaw,
        mediaSource: carousel ? "carousel_images" : "google_drive_link",
        target: {
          platform: "Threads",
          account_id: threadsUserId,
          account_label: body.account_label != null ? String(body.account_label) : "",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "schedule_insert_failed";
      const mapped = mapScheduleInsertError(message);
      return threadsContentJson(mapped.body, mapped.status);
    }

    if (action === "post_now") return await handlePostNowResponse(admin, inserted);
    return threadsContentJson({ ok: true, schedule: inserted }, 200);
  }

  return threadsContentJson({ error: "Unknown action" }, 400);
});
