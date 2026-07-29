/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireOrgAdmin,
  youtubeContentCorsHeaders,
} from "../_shared/youtubeContentAuth.ts";
import {
  getPlanEligibilityMissingReasons,
  isPlanEligibleForAutoSchedule,
} from "../_shared/scheduledPosts/scheduledPostEligibility.ts";
import type { PlanPublishTargetInput } from "../_shared/scheduledPosts/createPlatformScheduleRow.ts";
import {
  preparePlanBulkPostNow,
  runPlanBulkPostNowJob,
} from "../_shared/scheduledPosts/runPlanBulkPostNow.ts";

function planPublishJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...youtubeContentCorsHeaders, "Content-Type": "application/json" },
  });
}

async function loadPlanForPublish(
  admin: ReturnType<typeof createClient>,
  planId: string,
) {
  const { data, error } = await admin
    .from("social_media_plans")
    .select(
      "id, organization_id, post_date, approved, production_approved, google_drive_link, service_id, content_type:content_types(name)",
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
    service_id: string | null;
    content_type?: { name?: string } | null;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: youtubeContentCorsHeaders });
  }
  if (req.method !== "POST") {
    return planPublishJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return planPublishJson({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return planPublishJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  if (action !== "post_now_bulk") {
    return planPublishJson({ error: "Unknown action" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  const planId = String(body.social_media_plan_id ?? "").trim();
  if (!organizationId) return planPublishJson({ error: "Missing organization_id" }, 400);
  if (!planId) return planPublishJson({ error: "Missing social_media_plan_id" }, 400);

  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;
  const userId = userRes.userId;

  const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
  if (orgForbidden) return orgForbidden;
  const adminForbidden = await requireOrgAdmin(admin, userId, organizationId);
  if (adminForbidden) return adminForbidden;

  const plan = await loadPlanForPublish(admin, planId);
  if (!plan || plan.organization_id !== organizationId) {
    return planPublishJson({ error: "Plan not found" }, 404);
  }

  const eligibility = {
    post_date: plan.post_date,
    approved: plan.approved,
    production_approved: plan.production_approved,
    google_drive_link: plan.google_drive_link,
    content_type_name: plan.content_type?.name ?? null,
    service_id: plan.service_id,
  };

  if (!isPlanEligibleForAutoSchedule(eligibility)) {
    const missing = getPlanEligibilityMissingReasons(eligibility);
    if (!String(plan.service_id ?? "").trim()) missing.push("service_id");
    return planPublishJson({
      error: "plan_not_eligible",
      missing,
    }, 400);
  }

  const rawTargets = body.targets;
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
    return planPublishJson({ error: "Missing targets" }, 400);
  }

  const targets: PlanPublishTargetInput[] = rawTargets.map((t) => {
    const row = t as Record<string, unknown>;
    return {
      platform: String(row.platform ?? "").trim(),
      account_id: String(row.account_id ?? "").trim(),
      account_label: String(row.account_label ?? "").trim(),
      privacy_level: row.privacy_level != null ? String(row.privacy_level) : undefined,
    };
  });

  const driveLink = plan.google_drive_link?.trim() ?? "";
  if (!driveLink) {
    return planPublishJson({ error: "google_drive_link" }, 400);
  }

  const caption = body.caption != null ? String(body.caption) : null;
  const title = body.title != null ? String(body.title) : null;
  const employeeId = body.employee_id != null ? String(body.employee_id) : null;

  const prepared = await preparePlanBulkPostNow(admin, {
    organizationId,
    planId,
    driveLink,
    caption,
    title,
    employeeId,
    userId,
    targets,
  });

  if (!prepared.ok || prepared.schedules.length === 0) {
    return planPublishJson({
      ok: false,
      error: "no_schedules_created",
      results: prepared.results,
    }, 400);
  }

  const jobPromise = runPlanBulkPostNowJob(
    admin,
    {
      organizationId,
      planId,
      driveLink,
      caption,
      title,
      employeeId,
      userId,
      targets,
    },
    prepared.schedules,
  );

  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(jobPromise);
  } else {
    await jobPromise;
  }

  return planPublishJson({
    ok: true,
    processing: true,
    schedules: prepared.schedules,
    partial_insert_errors: prepared.results,
  }, 200);
});
