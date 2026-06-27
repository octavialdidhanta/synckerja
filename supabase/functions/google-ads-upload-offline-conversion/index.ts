/**
 * Upload offline click conversion to Google Ads (legacy single-lead invoke).
 *
 * @deprecated Prefer deferred flow: enqueue_google_ads_conversion_pending RPC +
 *   google-ads-upload-pending-conversions (pg_cron hourly).
 *
 * Deploy: supabase functions deploy google-ads-upload-offline-conversion
 */
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processGoogleAdsConversionUpload } from "../_shared/googleAdsConversionUpload.ts";
import {
  isAuthorizedServiceCaller,
  resolveSupabaseAdminKey,
} from "../_shared/serviceRoleEdgeAuth.ts";

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
  const serviceRoleKey = resolveSupabaseAdminKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  if (!isAuthorizedServiceCaller(req)) {
    return json({ error: "Unauthorized — service role only (use deferred batch upload)" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const leadId = String(body.lead_id ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  const salesActivityId = body.sales_activity_id != null
    ? String(body.sales_activity_id).trim() || null
    : null;

  if (!leadId || !organizationId) {
    return json({ error: "Missing lead_id or organization_id" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const result = await processGoogleAdsConversionUpload(admin, organizationId, leadId, {
    salesActivityId,
    skipIfSuccess: true,
    incrementAttempt: true,
  });

  if (result.duplicate) return json({ ok: true, duplicate: true }, 200);
  if (result.skipped) return json({ ok: true, skipped: true, reason: result.reason }, 200);
  if (result.uploaded) return json({ ok: true, uploaded: true }, 200);
  if (!result.ok) return json({ ok: false, error: result.error }, 502);

  return json({ ok: true }, 200);
});
