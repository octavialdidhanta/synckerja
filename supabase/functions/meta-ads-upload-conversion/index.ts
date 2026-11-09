/**
 * Upload Meta Conversions API event when a CRM lead becomes Converted.
 * Supports fbclid (web ads) and ctwa_clid (Click-to-WhatsApp ads).
 *
 * Deploy: supabase functions deploy meta-ads-upload-conversion
 */
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCtwaDestination } from "../_shared/ctwaCapiDestination.ts";
import { resolveCtwaClidForLead } from "../_shared/ctwaLeadSync.ts";
import {
  fbclidCapturedAtToEpoch,
  resolveFbclidCapturedAtIso,
} from "../_shared/fbclidCapture.ts";
import {
  buildCtwaCapiEvent,
  buildFbcFromFbclid,
  hashMetaUserData,
  mergeFbclid,
  sendMetaCapiEvents,
  type MetaCapiEventPayload,
} from "../_shared/metaAdsCapiHelpers.ts";
import { metaAdsCorsHeaders, metaGraphVersion } from "../_shared/metaAdsAuth.ts";
import { sanitizeMetaCapiEventName } from "../_shared/metaCapiEventName.ts";
import { resolveOrgMetaAdsForUpload } from "../_shared/metaAdsOrgResolver.ts";

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...metaAdsCorsHeaders, "Content-Type": "application/json" },
  });
}

type UploadKind = "fbclid" | "ctwa" | "both";

type LogRow = {
  organization_id: string;
  lead_id: string;
  sales_activity_id: string | null;
  meta_ads_account_id: string | null;
  fbclid: string | null;
  ctwa_clid: string | null;
  upload_kind: UploadKind | null;
  event_name: string | null;
  status: "success" | "failed" | "skipped";
  skip_reason: string | null;
  error_message: string | null;
  meta_response: unknown;
  fbc_click_epoch?: number | null;
};

type ExistingLog = {
  status: string;
  upload_kind: UploadKind | null;
};

async function upsertLog(admin: ReturnType<typeof createClient>, row: LogRow): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from("meta_ads_conversion_uploads").upsert(
    { ...row, updated_at: now },
    { onConflict: "lead_id" },
  );
  if (error) console.error("meta_ads_conversion_uploads upsert:", error);
}

function isDuplicateSuccess(existingLog: ExistingLog | null, canSendCtwa: boolean, canSendFbclid: boolean): boolean {
  if (existingLog?.status !== "success") return false;
  const kind = existingLog.upload_kind;
  if (kind === "both") return true;
  if (kind === "fbclid" && canSendCtwa) return false;
  if (kind === "ctwa" && canSendFbclid) return false;
  return true;
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

  const isInternalService = token === serviceRoleKey;

  if (!isInternalService) {
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
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select(
      "id, organization_id, ticket_id, fbclid, fbclid_captured_at, analytics_session_id, created_at, ctwa_clid, converted_at, attribution, meta_ads_account_id, phone_number",
    )
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (leadErr || !lead?.id) return json({ error: "Lead not found" }, 404);

  const { data: existingLogRaw } = await admin
    .from("meta_ads_conversion_uploads")
    .select("status, upload_kind")
    .eq("lead_id", leadId)
    .maybeSingle();

  const existingLog = (existingLogRaw ?? null) as ExistingLog | null;

  const leadAccountId = lead.meta_ads_account_id != null ? String(lead.meta_ads_account_id) : null;
  const resolved = await resolveOrgMetaAdsForUpload(admin, organizationId, leadAccountId);

  const fbclid = mergeFbclid(
    lead.fbclid != null ? String(lead.fbclid) : null,
    lead.attribution,
  );

  let sessionCapturedAt: string | null = null;
  let sessionStartedAt: string | null = null;
  let sessionFbclid: string | null = null;
  const analyticsSessionId = lead.analytics_session_id != null
    ? String(lead.analytics_session_id).trim()
    : "";
  if (analyticsSessionId && fbclid) {
    const { data: session } = await admin
      .from("analytics_sessions")
      .select("fbclid_captured_at, started_at, fbclid")
      .eq("id", analyticsSessionId)
      .maybeSingle();
    if (session) {
      sessionCapturedAt = session.fbclid_captured_at != null
        ? String(session.fbclid_captured_at)
        : null;
      sessionStartedAt = session.started_at != null ? String(session.started_at) : null;
      sessionFbclid = session.fbclid != null ? String(session.fbclid) : null;
    }
  }

  const clickCapturedAtIso = resolveFbclidCapturedAtIso({
    columnCapturedAt: lead.fbclid_captured_at != null
      ? String(lead.fbclid_captured_at)
      : null,
    attribution: lead.attribution,
    sessionCapturedAt,
    sessionStartedAt,
    sessionFbclid,
    leadCreatedAt: lead.created_at != null ? String(lead.created_at) : null,
  });
  const fbcClickEpoch = fbclidCapturedAtToEpoch(clickCapturedAtIso);

  const ctwaClid = await resolveCtwaClidForLead(admin, {
    organizationId,
    ticketId: lead.ticket_id != null ? String(lead.ticket_id) : null,
    leadCtwaClid: lead.ctwa_clid != null ? String(lead.ctwa_clid) : null,
    attribution: lead.attribution,
  });

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
  if (!phone && lead.phone_number?.trim()) {
    phone = String(lead.phone_number).trim();
  }

  const hashed = await hashMetaUserData(email, phone);
  const hasContact = Boolean(hashed.em?.length || hashed.ph?.length);
  const fbc = buildFbcFromFbclid(fbclid, fbcClickEpoch);

  const eventName = sanitizeMetaCapiEventName(resolved?.account.default_event_name);

  const baseLog: LogRow = {
    organization_id: organizationId,
    lead_id: leadId,
    sales_activity_id: salesActivityId,
    meta_ads_account_id: resolved?.account.id ?? null,
    fbclid,
    ctwa_clid: ctwaClid,
    upload_kind: null,
    event_name: eventName,
    status: "skipped",
    skip_reason: null,
    error_message: null,
    meta_response: null,
    fbc_click_epoch: fbcClickEpoch ?? null,
  };

  // Web ads (fbclid) go to the ad account Pixel with the Meta Ads token.
  const pixelId = resolved?.account.pixel_id?.replace(/\D/g, "") ?? "";
  let fbclidBlock: string | null = null;
  if (!resolved) fbclidBlock = "meta_ads_not_configured";
  else if (!resolved.uploadsEnabled) fbclidBlock = "uploads_disabled";
  else if (!pixelId || pixelId === "0") fbclidBlock = "pixel_not_configured";

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

  // Click-to-WhatsApp (ctwa_clid) goes to the WhatsApp account dataset with the WhatsApp token,
  // so it does not need the Meta Ads connection or a Pixel.
  const canSendCtwa = Boolean(ctwaClid);
  const canSendFbclid = !fbclidBlock && Boolean(fbc || (fbclid && hasContact));

  if (isDuplicateSuccess(existingLog, canSendCtwa, canSendFbclid)) {
    return json({ ok: true, duplicate: true }, 200);
  }

  const priorKind = existingLog?.status === "success" ? existingLog.upload_kind : null;
  const includeCtwa = canSendCtwa && priorKind !== "ctwa" && priorKind !== "both";
  const includeFbclid = canSendFbclid && priorKind !== "fbclid" && priorKind !== "both";

  if (!includeCtwa && !includeFbclid) {
    baseLog.skip_reason = fbclidBlock && !canSendCtwa ? fbclidBlock : "no_ctwa_or_fbclid_or_contact";
    await upsertLog(admin, baseLog);
    return json({ ok: true, skipped: true, reason: baseLog.skip_reason }, 200);
  }

  const succeeded = new Set<"ctwa" | "fbclid">();
  if (priorKind === "ctwa" || priorKind === "fbclid") succeeded.add(priorKind);
  const errors: string[] = [];
  const responses: Record<string, unknown> = {};

  if (includeCtwa && ctwaClid) {
    const dest = await resolveCtwaDestination(admin, organizationId, ctwaClid, metaGraphVersion());
    if (dest.ok === false) {
      errors.push(`ctwa: ${dest.reason}`);
      responses.ctwa = dest.detail ?? null;
    } else {
      const ctwaEvent = buildCtwaCapiEvent({
        ctwa_clid: ctwaClid,
        whatsapp_business_account_id: dest.destination.wabaId,
        event_name: eventName,
        event_time: eventTime,
        event_id: `lead_${leadId}:ctwa`,
        hashedUserData: hashed,
        conversionValue,
        currency,
        leadId,
      });
      const result = await sendMetaCapiEvents(
        dest.destination.datasetId,
        dest.destination.accessToken,
        [ctwaEvent],
        metaGraphVersion(),
      );
      responses.ctwa = result.body;
      if (result.ok) succeeded.add("ctwa");
      else errors.push(`ctwa: ${result.error ?? "capi_failed"}`);
    }
  }

  if (includeFbclid && resolved) {
    const userData: Record<string, unknown> = { ...hashed };
    if (fbc) userData.fbc = fbc;
    const fbclidEvent: MetaCapiEventPayload = {
      event_name: eventName,
      event_time: eventTime,
      event_id: `lead_${leadId}`,
      action_source: "system_generated",
      user_data: userData,
      custom_data: {
        value: conversionValue,
        currency,
        lead_id: leadId,
      },
    };
    const result = await sendMetaCapiEvents(pixelId, resolved.accessToken, [fbclidEvent], metaGraphVersion());
    responses.fbclid = result.body;
    if (result.ok) succeeded.add("fbclid");
    else errors.push(`fbclid: ${result.error ?? "capi_failed"}`);
  }

  baseLog.meta_response = responses;
  baseLog.error_message = errors.length ? errors.join("; ") : null;

  if (succeeded.size === 0) {
    baseLog.status = "failed";
    baseLog.upload_kind = includeCtwa && includeFbclid ? "both" : includeCtwa ? "ctwa" : "fbclid";
    await upsertLog(admin, baseLog);
    return json({ ok: false, error: baseLog.error_message ?? "capi_failed" }, 400);
  }

  const uploadKind: UploadKind = succeeded.size === 2 ? "both" : succeeded.has("ctwa") ? "ctwa" : "fbclid";
  baseLog.status = "success";
  baseLog.upload_kind = uploadKind;
  await upsertLog(admin, baseLog);
  return json({ ok: true, upload_kind: uploadKind, partial_error: baseLog.error_message }, 200);
});
