/**
 * Upload offline click conversion to Google Ads when a CRM lead becomes Converted.
 *
 * Deploy: supabase functions deploy google-ads-upload-offline-conversion
 * Platform secrets: GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN,
 *   GOOGLE_ADS_CONFIG_ENCRYPTION_KEY, GOOGLE_ADS_OAUTH_REDIRECT_URI, APP_PUBLIC_URL
 * Per-org: organization_google_ads_connections + organization_google_ads_connection_tokens + accounts
 *
 * Invoke (authenticated): POST { lead_id, organization_id, sales_activity_id? }
 */
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrgGoogleAdsForUpload } from "../_shared/googleAdsOrgResolver.ts";
import {
  fetchGoogleAdsAccessToken,
  formatConversionDateTimeWib,
  hasAnyClickId,
  hasHashableContact,
  hashUserIdentifiers,
  mergeClickIds,
  parseClickIdsFromAttribution,
  uploadClickConversion,
} from "./googleAdsHelpers.ts";

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

type LogRow = {
  organization_id: string;
  lead_id: string;
  sales_activity_id: string | null;
  gclid: string | null;
  status: "success" | "failed" | "skipped";
  skip_reason: string | null;
  error_message: string | null;
  google_ads_partial_failure: unknown;
  google_ads_account_id: string | null;
  customer_id_snapshot: string | null;
};

async function upsertLog(
  admin: ReturnType<typeof createClient>,
  row: LogRow,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from("google_ads_conversion_uploads").upsert(
    {
      ...row,
      updated_at: now,
    },
    { onConflict: "lead_id" },
  );
  if (error) console.error("google_ads_conversion_uploads upsert:", error);
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
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) {
    return json({ error: "Unauthorized" }, 401);
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

  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return json({ error: "Invalid token" }, 401);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  const activeOrg = profile?.active_organization_id != null
    ? String(profile.active_organization_id)
    : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return json({ error: "Forbidden" }, 403);
  }

  const { data: existingLog } = await admin
    .from("google_ads_conversion_uploads")
    .select("status")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (existingLog?.status === "success") {
    return json({ ok: true, duplicate: true }, 200);
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, organization_id, gclid, converted_at, attribution, google_ads_account_id")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (leadErr || !lead?.id) {
    return json({ error: "Lead not found" }, 404);
  }

  const leadAccountId = lead.google_ads_account_id != null
    ? String(lead.google_ads_account_id)
    : null;

  const resolved = await resolveOrgGoogleAdsForUpload(admin, organizationId, leadAccountId);

  const attrIds = parseClickIdsFromAttribution(lead.attribution);
  const columnGclid = lead.gclid != null ? String(lead.gclid).trim() : null;
  const clickIds = mergeClickIds(columnGclid || null, attrIds);
  const gclidSnapshot = clickIds.gclid ?? clickIds.gbraid ?? clickIds.wbraid ?? null;

  const { data: submission } = await admin
    .from("lead_submissions")
    .select("email, phone_number")
    .eq("lead_id", leadId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("submitted_at", { ascending: false })
    .limit(5);

  let email: string | null = null;
  let phone: string | null = null;
  for (const row of submission ?? []) {
    const r = row as { email?: string | null; phone_number?: string | null };
    if (!email && r.email?.trim()) email = r.email.trim();
    if (!phone && r.phone_number?.trim()) phone = r.phone_number.trim();
    if (email && phone) break;
  }

  const hashed = await hashUserIdentifiers(email, phone);
  const hasClick = hasAnyClickId(clickIds);
  const hasContact = hasHashableContact(hashed);

  const accountIdForLog = resolved?.account.accountId === "legacy-global"
    ? null
    : resolved?.account.accountId ?? null;

  const baseLog: LogRow = {
    organization_id: organizationId,
    lead_id: leadId,
    sales_activity_id: salesActivityId,
    gclid: gclidSnapshot,
    status: "skipped",
    skip_reason: null,
    error_message: null,
    google_ads_partial_failure: null,
    google_ads_account_id: accountIdForLog,
    customer_id_snapshot: resolved?.config.customerId ?? null,
  };

  if (!resolved) {
    baseLog.skip_reason = "google_ads_not_configured";
    await upsertLog(admin, baseLog);
    return json({ ok: true, skipped: true, reason: baseLog.skip_reason }, 200);
  }

  if (!hasClick && !hasContact) {
    baseLog.skip_reason = "no_gclid_or_contact";
    await upsertLog(admin, baseLog);
    return json({ ok: true, skipped: true, reason: baseLog.skip_reason }, 200);
  }

  let conversionValue = 1;
  if (salesActivityId) {
    const { data: activity } = await admin
      .from("sales_activities")
      .select("total_amount")
      .eq("id", salesActivityId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const amt = Number(activity?.total_amount);
    if (Number.isFinite(amt) && amt > 0) conversionValue = amt;
  }

  const conversionDateTime = formatConversionDateTimeWib(
    lead.converted_at != null ? String(lead.converted_at) : null,
  );

  try {
    const accessToken = await fetchGoogleAdsAccessToken(resolved.config);
    const upload = await uploadClickConversion(resolved.config, accessToken, {
      clickIds,
      conversionDateTime,
      conversionValue,
      currencyCode: "IDR",
      hashed,
    });

    if (!upload.ok) {
      baseLog.status = "failed";
      baseLog.error_message = upload.errorMessage ?? "upload_failed";
      baseLog.google_ads_partial_failure = upload.partialFailure ?? null;
      await upsertLog(admin, baseLog);
      return json({
        ok: false,
        error: baseLog.error_message,
        partialFailure: upload.partialFailure,
      }, 502);
    }

    baseLog.status = "success";
    baseLog.google_ads_partial_failure = upload.partialFailure ?? null;
    await upsertLog(admin, baseLog);
    return json({ ok: true, uploaded: true }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("google-ads-upload-offline-conversion:", msg);
    baseLog.status = "failed";
    baseLog.error_message = msg.slice(0, 1000);
    await upsertLog(admin, baseLog);
    return json({ ok: false, error: msg }, 502);
  }
});
