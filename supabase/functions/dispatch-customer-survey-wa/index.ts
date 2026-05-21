/**
 * Dispatch queued customer survey WhatsApp messages after resolve (system send; bypasses agent send gate).
 *
 * Deploy: `supabase functions deploy dispatch-customer-survey-wa --no-verify-jwt`
 * Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SURVEY_PUBLIC_ORIGIN` (https://survey.example.com),
 *          `CUSTOMER_SURVEY_DISPATCH_SECRET` (required for cron ticks).
 *
 * Schedule: Dashboard → Edge Functions → Schedules → POST every minute with body `{}` or `{ "action": "cron_tick" }`
 * and header `x-customer-survey-dispatch-secret: <CUSTOMER_SURVEY_DISPATCH_SECRET>`.
 *
 * Immediate dispatch after manual resolve (authenticated browser): `{ "action": "after_resolve", "whatsapp_conversation_id": "<uuid>" }`
 * with `Authorization: Bearer <user access_token>` — verifies caller profile.active_organization_id matches the conversation org,
 * then processes at most one `pending_send` row for that conversation.
 */
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-customer-survey-dispatch-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_API_BASE = "https://graph.facebook.com/v18.0";
const BATCH_LIMIT = 25;

function digitsOnly(to: string): string {
  return String(to ?? "").replace(/\D/g, "");
}

function parseWabaExpirationUnixSeconds(meta: Record<string, unknown>): number | null {
  const messages = meta.messages as unknown[] | undefined;
  const first = messages?.[0] as Record<string, unknown> | undefined;
  const conv = first?.conversation as { expiration_timestamp?: string | number } | undefined;
  const raw = conv?.expiration_timestamp;
  if (raw == null) return null;
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function markWhatsappConversationExpiredReactive(
  admin: ReturnType<typeof createClient>,
  conversationId: string,
  orgIdHint: string | null,
): Promise<void> {
  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("organization_id, lead_status_id")
    .eq("id", conversationId)
    .maybeSingle();
  const orgId = (conv?.organization_id as string | undefined) ?? orgIdHint;
  if (!orgId) return;

  let expiredId: string | null = null;
  const { data: orgExpired } = await admin
    .from("lead_statuses")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", "Expired")
    .maybeSingle();
  expiredId = (orgExpired?.id as string | undefined) ?? null;
  if (!expiredId) {
    const { data: g } = await admin
      .from("lead_statuses")
      .select("id")
      .is("organization_id", null)
      .eq("name", "Expired")
      .maybeSingle();
    expiredId = (g?.id as string | undefined) ?? null;
  }
  if (!expiredId) return;

  let statusName = "";
  let oldStatusLabel: string | null = null;
  if (conv?.lead_status_id) {
    const { data: stRow } = await admin
      .from("lead_statuses")
      .select("name")
      .eq("id", conv.lead_status_id as string)
      .maybeSingle();
    oldStatusLabel = (stRow?.name as string) ?? null;
    statusName = (oldStatusLabel ?? "").trim().toLowerCase();
  }
  if (["closed", "resolve", "lost", "converted", "expired"].includes(statusName)) return;

  const nowIso = new Date().toISOString();
  await admin
    .from("whatsapp_conversations")
    .update({ lead_status_id: expiredId, meta_session_expires_at: nowIso, updated_at: nowIso })
    .eq("id", conversationId);

  await admin.from("whatsapp_conversation_status_history").insert({
    conversation_id: conversationId,
    old_status: oldStatusLabel,
    new_status: "Expired",
    changed_at: nowIso,
    changed_by: null,
    changed_by_name: "Meta",
    organization_id: orgId,
  });
}

type WaAccountConfig = { meta_access_token: string; phone_number_id: string };

async function resolveWhatsappAccountConfig(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  phoneNumberId: string | null,
): Promise<WaAccountConfig | null> {
  const tryAccount = async (pnId: string | null) => {
    const base = admin
      .from("organization_whatsapp_accounts")
      .select("meta_access_token, phone_number_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    const q = pnId ? base.eq("phone_number_id", pnId) : base.limit(1);
    const { data: rows, error } = await q;
    const data = Array.isArray(rows) ? rows[0] : null;
    if (!error && data?.phone_number_id) {
      let accessToken = (data.meta_access_token ?? "").trim();
      if (!accessToken) {
        const { data: orgMeta } = await admin
          .from("organization_meta_config")
          .select("meta_access_token")
          .eq("organization_id", organizationId)
          .maybeSingle();
        accessToken = (orgMeta?.meta_access_token ?? "").trim();
      }
      if (accessToken) {
        return { meta_access_token: accessToken, phone_number_id: data.phone_number_id };
      }
    }
    return null;
  };

  if (phoneNumberId) {
    const withPn = await tryAccount(phoneNumberId);
    if (withPn) return withPn;
  }
  return await tryAccount(null);
}

function normalizeSurveyOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

async function insertOutboundSurveyMessage(
  admin: ReturnType<typeof createClient>,
  conversationId: string,
  waMessageId: string | null,
  body: string,
  metaData: Record<string, unknown>,
): Promise<void> {
  const insertPayload: Record<string, unknown> = {
    conversation_id: conversationId,
    direction: "outbound",
    wa_message_id: waMessageId,
    platform_message_id: waMessageId,
    channel: "whatsapp",
    body,
    message_type: "text",
    raw_metadata: { ...metaData, system_customer_survey: true },
    status: "sent",
  };

  const compatibilityPayload: Record<string, unknown> = { ...insertPayload };
  const dropColumnsInOrder = [
    "reply_to_message_type",
    "reply_to_sender",
    "reply_to_body",
    "reply_to_wa_message_id",
    "status",
    "platform_message_id",
    "channel",
  ] as const;

  for (const col of [null, ...dropColumnsInOrder]) {
    if (col) delete compatibilityPayload[col];
    const attempt = await admin.from("whatsapp_messages").insert(compatibilityPayload);
    if (!attempt.error) return;
  }
}

async function processOneInvitation(
  admin: ReturnType<typeof createClient>,
  invitationId: string,
  surveyOrigin: string,
): Promise<{ ok: boolean; code?: string }> {
  const { data: inv, error: invErr } = await admin
    .from("customer_survey_invitations")
    .select(
      "id, organization_id, whatsapp_conversation_id, phone_number_id, public_token, status",
    )
    .eq("id", invitationId)
    .maybeSingle();

  if (invErr || !inv) return { ok: false, code: "inv_missing" };
  if ((inv as { status?: string }).status !== "pending_send") return { ok: true };

  const convId = String((inv as { whatsapp_conversation_id: string }).whatsapp_conversation_id);
  const orgId = String((inv as { organization_id: string }).organization_id);
  const token = String((inv as { public_token: string }).public_token);
  const pnIdRow = (inv as { phone_number_id?: string | null }).phone_number_id ?? null;

  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("id, organization_id, customer_wa_id, phone_number_id")
    .eq("id", convId)
    .maybeSingle();

  if (!conv) {
    await admin
      .from("customer_survey_invitations")
      .update({
        status: "skipped",
        error_message: "conversation_missing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);
    return { ok: true, code: "skipped" };
  }

  const customerWa = digitsOnly(String((conv as { customer_wa_id?: string }).customer_wa_id ?? ""));
  if (!customerWa) {
    await admin
      .from("customer_survey_invitations")
      .update({
        status: "skipped",
        error_message: "missing_customer_wa",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);
    return { ok: true, code: "skipped" };
  }

  const resolvedPnId = pnIdRow ?? ((conv as { phone_number_id?: string | null }).phone_number_id ?? null);

  const resolved = await resolveWhatsappAccountConfig(admin, orgId, resolvedPnId);
  if (!resolved) {
    await admin
      .from("customer_survey_invitations")
      .update({
        status: "send_failed",
        error_message: "whatsapp_not_configured",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);
    return { ok: false, code: "no_account" };
  }

  const { data: settings } = await admin
    .from("organization_customer_survey_settings")
    .select("closing_message")
    .eq("organization_id", orgId)
    .maybeSingle();

  const closing = String((settings as { closing_message?: string } | null)?.closing_message ?? "").trim();
  const surveyUrl = `${surveyOrigin}/s/${token}`;
  const customerBodyText = closing.length > 0 ? `${closing}\n\n${surveyUrl}` : surveyUrl;
  const clipped = customerBodyText.slice(0, 4090);
  /** Stored in DB / inbox UI only — no survey URL (customer receives full text via Meta). */
  const agentInboxBody = (closing.length > 0 ? closing : "Customer survey invitation sent to the customer.").slice(
    0,
    4090,
  );

  const metaUrl = `${META_API_BASE}/${resolved.phone_number_id}/messages`;
  const metaBody = {
    messaging_product: "whatsapp",
    to: customerWa,
    type: "text",
    text: { body: clipped },
  };

  const metaRes = await fetch(metaUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resolved.meta_access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metaBody),
  });

  const metaData = await metaRes.json().catch(() => ({}));

  if (!metaRes.ok) {
    const metaError = (metaData as { error?: { message?: string; code?: number; error_subcode?: number } })?.error;
    const metaMsg = metaError?.message ?? (metaData as { error_message?: string }).error_message ?? "Meta API error";
    const code = metaError?.code;
    const looksLikeSessionExpired =
      Number(code) === 131047 ||
      Number(code) === 131026 ||
      /re-engagement|24 hours|outside the window|session has expired|outside of allowed window/i.test(String(metaMsg));

    if (looksLikeSessionExpired) {
      await markWhatsappConversationExpiredReactive(admin, convId, orgId);
    }

    await admin
      .from("customer_survey_invitations")
      .update({
        status: "send_failed",
        error_message: String(metaMsg).slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    return { ok: false, code: "meta_error" };
  }

  const waMessageId = (metaData as { messages?: { id?: string }[] }).messages?.[0]?.id ?? null;

  const expSec = parseWabaExpirationUnixSeconds(metaData as Record<string, unknown>);
  if (expSec != null) {
    const expIso = new Date(expSec * 1000).toISOString();
    const { data: prevRow } = await admin
      .from("whatsapp_conversations")
      .select("meta_session_expires_at")
      .eq("id", convId)
      .maybeSingle();
    const prev = prevRow?.meta_session_expires_at;
    const prevMs = prev != null && String(prev).trim() !== "" ? new Date(String(prev)).getTime() : NaN;
    const useNew = Number.isNaN(prevMs) || prevMs < expSec * 1000;
    if (useNew) {
      await admin
        .from("whatsapp_conversations")
        .update({ meta_session_expires_at: expIso, updated_at: new Date().toISOString() })
        .eq("id", convId);
    }
  }

  await insertOutboundSurveyMessage(
    admin,
    convId,
    waMessageId,
    agentInboxBody,
    { ...(metaData as Record<string, unknown>), customer_body_sent: clipped },
  );

  await admin
    .from("customer_survey_invitations")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId);

  return { ok: true };
}

async function handleAfterResolve(
  req: Request,
  admin: ReturnType<typeof createClient>,
  surveyOrigin: string,
  convId: string,
): Promise<Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: conv, error: convErr } = await admin
    .from("whatsapp_conversations")
    .select("organization_id")
    .eq("id", convId)
    .maybeSingle();

  if (convErr || !conv?.organization_id) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const convOrgId = String((conv as { organization_id: string }).organization_id);

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  const activeOrg = profile?.active_organization_id != null
    ? String(profile.active_organization_id)
    : "";
  if (!activeOrg || activeOrg !== convOrgId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: pendingRows, error: pendErr } = await admin
    .from("customer_survey_invitations")
    .select("id")
    .eq("whatsapp_conversation_id", convId)
    .eq("status", "pending_send")
    .order("created_at", { ascending: true })
    .limit(1);

  if (pendErr) {
    console.error(pendErr);
    return new Response(JSON.stringify({ error: pendErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pendingId = pendingRows?.[0]?.id != null ? String((pendingRows[0] as { id: string }).id) : null;
  if (!pendingId) {
    return new Response(JSON.stringify({ ok: true, processed: 0, results: [], reason: "no_pending" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const r = await processOneInvitation(admin, pendingId, surveyOrigin);
  return new Response(JSON.stringify({ ok: true, processed: 1, results: [{ id: pendingId, ...r }] }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const surveyOriginRaw = Deno.env.get("SURVEY_PUBLIC_ORIGIN") ?? "";
  const surveyOrigin = normalizeSurveyOrigin(surveyOriginRaw);

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const action = String(body.action ?? "cron_tick");

  if (!surveyOrigin || !surveyOrigin.startsWith("http")) {
    return new Response(JSON.stringify({ error: "SURVEY_PUBLIC_ORIGIN must be set to https://your-survey-host" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  if (action === "after_resolve") {
    const convId = String(body.whatsapp_conversation_id ?? "").trim();
    if (!convId) {
      return new Response(JSON.stringify({ error: "Missing whatsapp_conversation_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return await handleAfterResolve(req, admin, surveyOrigin, convId);
  }

  if (action !== "cron_tick") {
    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const secret = Deno.env.get("CUSTOMER_SURVEY_DISPATCH_SECRET") ?? "";
  const hdr = req.headers.get("x-customer-survey-dispatch-secret") ?? "";
  if (!secret || hdr !== secret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: pending, error: pendingErr } = await admin
    .from("customer_survey_invitations")
    .select("id")
    .eq("status", "pending_send")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (pendingErr) {
    console.error(pendingErr);
    return new Response(JSON.stringify({ error: pendingErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: unknown[] = [];
  for (const row of pending ?? []) {
    const id = String((row as { id: string }).id);
    const r = await processOneInvitation(admin, id, surveyOrigin);
    results.push({ id, ...r });
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
