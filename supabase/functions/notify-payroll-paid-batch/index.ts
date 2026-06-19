/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyPayrollRunPaidBatch } from "../_shared/payroll/notifyPayrollCalcPaid.ts";

const corsHeaders: Record<string, string> = {
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

type Body = {
  runId?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Server not configured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const callerToken = authHeader.replace(/Bearer\s+/i, "");
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !caller) {
      return json({ success: false, error: "Invalid session" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const runId = body.runId?.trim();
    if (!runId) {
      return json({ success: false, error: "runId is required" }, 400);
    }

    const { data: run } = await admin
      .from("payroll_runs")
      .select("organization_id")
      .eq("id", runId)
      .maybeSingle();

    if (!run?.organization_id) {
      return json({ success: false, error: "Payroll run not found" }, 404);
    }

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("organization_id", run.organization_id)
      .maybeSingle();

    const role = String(roleRow?.role ?? "").toLowerCase();
    if (role !== "owner" && role !== "admin") {
      return json({ success: false, error: "Forbidden: owner or admin required" }, 403);
    }

    const result = await notifyPayrollRunPaidBatch(admin, runId);
    return json({ success: true, ...result });
  } catch (e) {
    console.error(e);
    return json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
