// deno-lint-ignore-file no-explicit-any
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return json({ success: false, error: "Authorization header missing" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return json({ success: false, error: "Invalid session" }, 401);
    }

    const body = (await req.json()) as {
      candidateProfileId?: string;
      organizationId?: string;
    };
    const candidateProfileId = body.candidateProfileId?.trim();
    if (!candidateProfileId) {
      return json({ success: false, error: "candidateProfileId is required" }, 400);
    }

    let orgId = body.organizationId ?? null;
    if (!orgId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      orgId = profile?.active_organization_id ?? null;
    }
    if (!orgId) {
      return json({ success: false, error: "No active organization" }, 400);
    }

    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (roleErr || !roleRow?.role || !["owner", "admin", "hr"].includes(roleRow.role)) {
      return json({ success: false, error: "Insufficient permissions" }, 403);
    }

    const { error: probeErr } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("id", candidateProfileId)
      .limit(1)
      .maybeSingle();

    if (probeErr) {
      const msg = probeErr.message ?? "";
      const code = (probeErr as { code?: string }).code;
      if (code === "42P01" || msg.includes("candidate_profiles") && msg.includes("does not exist")) {
        return json({
          success: false,
          error:
            "Recruitment database objects are not installed. Apply the recruitment schema migrations (job_openings, candidate_profiles, job_applications, RPCs) to your project.",
        });
      }
      return json({ success: false, error: probeErr.message }, 500);
    }

    return json({
      success: false,
      error:
        "Server-side migration is not deployed yet. Implement employee creation from candidate_profiles in this Edge Function after the recruitment schema is applied.",
      candidateProfileId,
    });
  } catch (e: any) {
    console.error("migrate-candidate-to-employee", e);
    return json({ success: false, error: e?.message ?? "Unexpected error" }, 500);
  }
});
