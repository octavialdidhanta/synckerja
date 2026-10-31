/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserFromBearer, requireActiveOrg } from "../_shared/tiktokContentAuth.ts";
import { runPlanAutoSchedule } from "../_shared/scheduledPosts/planAutoSchedule.ts";
import {
  isActiveOrganizationMember,
  mcpScheduleUserId,
} from "../_shared/scheduledPosts/scheduledPostsInternalAuth.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  const planId = String(body.social_media_plan_id ?? "").trim();
  if (!organizationId || !planId) {
    return json({ error: "Missing organization_id or social_media_plan_id" }, 400);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const mcpUserId = mcpScheduleUserId("schedule", body);
  let internal: { secret: string; userId: string } | null = null;
  if (mcpUserId) {
    const member = await isActiveOrganizationMember(admin, mcpUserId, organizationId);
    if (!member) return json({ error: "Forbidden" }, 403);
    internal = {
      secret: String(body.internal_secret),
      userId: mcpUserId,
    };
  } else {
    const userRes = await getUserFromBearer(admin, authHeader);
    if ("error" in userRes) return userRes.error;

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;
  }

  const result = await runPlanAutoSchedule(admin, {
    organizationId,
    planId,
    authHeader,
    supabaseUrl,
    anonKey,
    internal,
  });

  if (mcpUserId && result.planMissing) return json({ error: "not_found" }, 404);
  return json({
    eligible: result.eligible,
    scheduled: result.scheduled,
    skipped: result.skipped,
    failed: result.failed,
    blocked: result.blocked,
  }, 200);
});
