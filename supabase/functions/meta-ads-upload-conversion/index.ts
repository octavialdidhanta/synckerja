/**
 * Upload Meta Conversions API event when a CRM lead becomes Converted.
 *
 * Deploy: supabase functions deploy meta-ads-upload-conversion
 */
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildFbcFromFbclid,
  hashMetaUserData,
  mergeFbclid,
  sendMetaCapiEvents,
} from "../_shared/metaAdsCapiHelpers.ts";
import { metaAdsCorsHeaders, metaGraphVersion } from "../_shared/metaAdsAuth.ts";
import { resolveOrgMetaAdsForUpload } from "../_shared/metaAdsOrgResolver.ts";

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...metaAdsCorsHeaders, "Content-Type": "application/json" },
  });
}

type LogRow = {
  organization_id: string;
  lead_id: string;
  sales_activity_id: string | null;
  meta_ads_account_id: string | null;
  fbclid: string | null;
  event_name: string | null;
  status: "success" | "failed" | "skipped";
  skip_reason: string | null;
  error_message: string | null;
  meta_response: unknown;
};

async function upsertLog(admin: ReturnType<typeof createClient>, row: LogRow): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from("meta_ads_conversion_uploads").upsert(
    { ...row, updated_at: now },
    { onConflict: "lead_id" },
  );
  if (error) console.error("meta_ads_conversion_uploads upsert:", error);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: metaAdsCorsHeaders });
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
  if (!token) return json({ error: "Unauthorized" }, 401);

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
  if (userErr || !userRes?.user) return json({ error: "Invalid token" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  const activeOrg = profile?.active_organization_id != null ? String(profile.active_organization_id) : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return json({ error: "Forbidden" }, 403);
  }

  const { data: existingLog } = await admin
    .from("meta_ads_conversion_uploads")
    .select("status")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (existingLog?.status === "success") {
    return json({ ok: true, duplicate: true }, 200);
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, organization_id, fbclid, converted_at, attribution, meta_ads_account_id")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (leadErr || !lead?.id) return json({ error: "Lead not found" }, 404);

  const leadAccountId = lead.meta_ads_account_id != null ? String(lead.meta_ads_account_id) : null;
  const resolved = await resolveOrgMetaAdsForUpload(admin, organizationId, leadAccountId);

  const fbclid = mergeFbclid(
    lead.fbclid != null ? String(lead.fbclid) : null,
    lead.attribution,
  );

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

  const hashed = await hashMetaUserData(email, phone);
  const hasContact = Boolean(hashed.em?.length || hashed.ph?.length);
  const fbc = buildFbcFromFbclid(fbclid);

  const baseLog: LogRow = {
    organization_id: organizationId,
    lead_id: leadId,
    sales_activity_id: salesActivityId,
    meta_ads_account_id: resolved?.account.id ?? null,
    fbclid,
    event_name: resolved?.account.default_event_name ?? "Purchase",
    status: "skipped",
    skip_reason: null,
    error_message: null,
    meta_response: null,
  };

  if (!resolved) {
    baseLog.skip_reason = "meta_ads_not_configured";
    await upsertLog(admin, baseLog);
    return json({ ok: true, skipped: true, reason: baseLog.skip_reason }, 200);
  }

  if (!resolved.uploadsEnabled) {
    baseLog.skip_reason = "uploads_disabled";
    await upsertLog(admin, baseLog);
    return json({ ok: true, skipped: true, reason: baseLog.skip_reason }, 200);
  }

  const pixelId = resolved.account.pixel_id?.replace(/\D/g, "") ?? "";
  if (!pixelId || pixelId === "0") {
    baseLog.skip_reason = "pixel_not_configured";
    await upsertLog(admin, baseLog);
    return json({ ok: true, skipped: true, reason: baseLog.skip_reason }, 200);
  }

  if (!fbc && !hasContact) {
    baseLog.skip_reason = "no_fbclid_or_contact";
    await upsertLog(admin, baseLog);
    return json({ ok: true, skipped: true, reason: baseLog.skip_reason }, 200);
  }

  let conversionValue = 0;
  let currency = "IDR";
  if (salesActivityId) {
    const { data: activity } = await admin
      .from("sales_activities")
      .select("total_amount, currency")
      .eq("id", salesActivityId)
      .maybeSingle();
    if (activity?.total_amount != null) {
      conversionValue = Number(activity.total_amount) || 0;
    }
    if (activity?.currency?.trim()) currency = String(activity.currency).trim();
  }

  const convertedAt = lead.converted_at ? new Date(String(lead.converted_at)) : new Date();
  const eventTime = Math.floor(convertedAt.getTime() / 1000);
  const eventName = resolved.account.default_event_name?.trim() || "Purchase";

  const userData: Record<string, unknown> = { ...hashed };
  if (fbc) userData.fbc = fbc;

  const eventId = `lead_${leadId}`;

  const capiResult = await sendMetaCapiEvents(
    pixelId,
    resolved.accessToken,
    [{
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId,
      action_source: "system_generated",
      user_data: userData,
      custom_data: {
        value: conversionValue,
        currency,
        lead_id: leadId,
      },
    }],
    metaGraphVersion(),
  );

  if (!capiResult.ok) {
    baseLog.status = "failed";
    baseLog.error_message = capiResult.error ?? "capi_failed";
    baseLog.meta_response = capiResult.body;
    await upsertLog(admin, baseLog);
    return json({ ok: false, error: baseLog.error_message }, 400);
  }

  baseLog.status = "success";
  baseLog.event_name = eventName;
  baseLog.meta_response = capiResult.body;
  await upsertLog(admin, baseLog);
  return json({ ok: true }, 200);
});
