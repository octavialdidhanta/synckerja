/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserFromBearer, isOmnichannelMetaAdsAdmin } from "../_shared/metaAdsAuth.ts";
import { META_GRAPH_BASE } from "../_shared/metaGraphVersion.ts";
import {
  type ConnectMode,
  type MetaPhoneNumber,
  parseSignupRequest,
  pickPhoneNumbers,
  randomPin,
} from "./logic.ts";

// WhatsApp Embedded Signup for Synckerja's own Meta app (Tech Provider).
//
// action "connect": exchange the Embedded Signup code for a business token, subscribe the
//   app to the client's WABA, save the number(s) in organization_whatsapp_accounts, and
//   for coexistence start the one-time contact + history sync (allowed once, within 24 h).
//   For cloud_api the number is registered with a random two-step PIN returned once.
// action "retry_sync": run the coexistence sync again for a number whose request failed.
//
// Caller: the integrations page with the user's Supabase JWT. Owner or omnichannel admin only.
// Env: META_APP_ID, META_APP_SECRET (Synckerja app), optional META_GRAPH_API_VERSION.

const MAX_ACCOUNTS_PER_ORG = 5;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type GraphError = { error?: { message?: string; code?: number } };

function safeMessage(message: string): string {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text || /access_token|client_secret|secret|bearer/i.test(text)) return "meta_request_failed";
  return text.slice(0, 200);
}

async function graph<T>(
  method: "GET" | "POST",
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${META_GRAPH_BASE}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || data?.error) throw new Error(safeMessage(data?.error?.message ?? `Graph error ${res.status}`));
  return data;
}

async function exchangeCode(code: string): Promise<string> {
  const appId = (Deno.env.get("META_APP_ID") ?? "").trim();
  const appSecret = (Deno.env.get("META_APP_SECRET") ?? "").trim();
  if (!appId || !appSecret) throw new Error("misconfigured: META_APP_ID / META_APP_SECRET");
  const url = `${META_GRAPH_BASE}/oauth/access_token?client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`;
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as { access_token?: string } & GraphError;
  if (!res.ok || !data.access_token) throw new Error(safeMessage(data?.error?.message ?? "code_exchange_failed"));
  return data.access_token;
}

async function startCoexSync(
  admin: SupabaseClient,
  token: string,
  organizationId: string,
  phoneNumberId: string,
): Promise<{ contacts: string | null; history: string | null; error: string | null }> {
  let contacts: string | null = null;
  let history: string | null = null;
  let error: string | null = null;
  try {
    const res = await graph<{ request_id?: string }>("POST", `${phoneNumberId}/smb_app_data`, token, {
      messaging_product: "whatsapp",
      sync_type: "smb_app_state_sync",
    });
    contacts = res.request_id ?? "requested";
  } catch (e) {
    error = `contacts: ${e instanceof Error ? e.message : String(e)}`;
  }
  try {
    const res = await graph<{ request_id?: string }>("POST", `${phoneNumberId}/smb_app_data`, token, {
      messaging_product: "whatsapp",
      sync_type: "history",
    });
    history = res.request_id ?? "requested";
  } catch (e) {
    const msg = `history: ${e instanceof Error ? e.message : String(e)}`;
    error = error ? `${error}; ${msg}` : msg;
  }
  await admin
    .from("organization_whatsapp_accounts")
    .update({
      contacts_sync_request_id: contacts,
      history_sync_request_id: history,
      history_sync_status: history ? "requested" : "error",
      history_sync_progress: history ? 0 : null,
      history_sync_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("phone_number_id", phoneNumberId);
  return { contacts, history, error };
}

async function saveAccount(
  admin: SupabaseClient,
  organizationId: string,
  wabaId: string,
  phone: MetaPhoneNumber,
  token: string,
  mode: ConnectMode,
): Promise<void> {
  const now = new Date().toISOString();
  const display = phone.display_phone_number
    ? (/^\+/.test(phone.display_phone_number) ? phone.display_phone_number : `+${phone.display_phone_number.replace(/\D/g, "")}`)
    : null;
  const row = {
    organization_id: organizationId,
    whatsapp_business_account_id: wabaId,
    phone_number_id: phone.id,
    meta_access_token: token,
    display_phone_number: display,
    whatsapp_business_name: phone.verified_name ?? null,
    name_status: phone.name_status ?? null,
    is_active: true,
    connection_mode: mode === "coexistence" ? "coexistence" : "embedded_cloud_api",
    coexistence_onboarded_at: mode === "coexistence" ? now : null,
    disconnected_reason: null,
    updated_at: now,
  };
  const { error } = await admin
    .from("organization_whatsapp_accounts")
    .upsert(row, { onConflict: "organization_id,phone_number_id" });
  if (error) throw new Error(`save_failed: ${error.code ?? ""}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "misconfigured" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const user = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in user) return user.error;

  const raw = await req.json().catch(() => null);
  const parsed = parseSignupRequest(raw);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const request = parsed.value;

  const { data: membership } = await admin
    .from("user_organizations")
    .select("is_active")
    .eq("user_id", user.userId)
    .eq("organization_id", request.organizationId)
    .maybeSingle();
  if (!membership || (membership as { is_active?: boolean | null }).is_active === false) {
    return json({ error: "forbidden" }, 403);
  }
  if (!(await isOmnichannelMetaAdsAdmin(admin, user.userId, request.organizationId))) {
    return json({ error: "forbidden: owner or omnichannel admin only" }, 403);
  }

  try {
    if (request.action === "retry_sync") {
      const { data: account } = await admin
        .from("organization_whatsapp_accounts")
        .select("meta_access_token, connection_mode, whatsapp_business_account_id")
        .eq("organization_id", request.organizationId)
        .eq("phone_number_id", request.phoneNumberId)
        .maybeSingle();
      const token = (account?.meta_access_token as string | null)?.trim();
      if (!token || account?.connection_mode !== "coexistence") return json({ error: "not_coexistence_account" }, 400);
      // A number added by hand (for example a WABA owned by Synckerja's own business portfolio,
      // where the Embedded Signup sharing step does not apply) may not have the app subscribed
      // yet. Subscribing again is harmless, so do it before asking Meta for the sync.
      let subscribeError: string | null = null;
      const wabaId = String(account?.whatsapp_business_account_id ?? "").trim();
      if (/^\d{5,25}$/.test(wabaId)) {
        try {
          await graph("POST", `${wabaId}/subscribed_apps`, token);
        } catch (e) {
          subscribeError = e instanceof Error ? e.message : String(e);
        }
      }
      const sync = await startCoexSync(admin, token, request.organizationId, request.phoneNumberId);
      return json({ ok: !sync.error && !subscribeError, subscribe_error: subscribeError, sync });
    }

    const token = await exchangeCode(request.code);

    // Subscribe Synckerja's app to the client WABA so its webhooks reach whatsapp-webhook.
    await graph("POST", `${request.wabaId}/subscribed_apps`, token);

    const numbers = await graph<{ data?: MetaPhoneNumber[] }>(
      "GET",
      `${request.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,name_status`,
      token,
    );
    const picked = pickPhoneNumbers(numbers.data ?? [], request.phoneNumberId);
    if (picked.length === 0) return json({ error: "no_phone_number_found" }, 400);

    const { data: existingRows } = await admin
      .from("organization_whatsapp_accounts")
      .select("phone_number_id")
      .eq("organization_id", request.organizationId);
    const existing = new Set(((existingRows ?? []) as Array<{ phone_number_id: string }>).map((r) => r.phone_number_id));
    const newCount = picked.filter((p) => !existing.has(p.id)).length;
    if (existing.size + newCount > MAX_ACCOUNTS_PER_ORG) {
      return json({ error: `account_limit: max ${MAX_ACCOUNTS_PER_ORG} WhatsApp numbers per organization` }, 400);
    }

    const results: Array<Record<string, unknown>> = [];
    for (const phone of picked) {
      let pin: string | null = null;
      if (request.mode === "cloud_api") {
        // Cloud API numbers must be registered; coexistence numbers are already registered in the app.
        pin = randomPin();
        await graph("POST", `${phone.id}/register`, token, { messaging_product: "whatsapp", pin });
      }
      await saveAccount(admin, request.organizationId, request.wabaId, phone, token, request.mode);
      const sync = request.mode === "coexistence"
        ? await startCoexSync(admin, token, request.organizationId, phone.id)
        : null;
      results.push({
        phone_number_id: phone.id,
        display_phone_number: phone.display_phone_number ?? null,
        verified_name: phone.verified_name ?? null,
        two_step_pin: pin,
        sync,
      });
    }
    return json({ ok: true, mode: request.mode, waba_id: request.wabaId, numbers: results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("whatsapp-embedded-signup failed", { organizationId: request.organizationId, message: safeMessage(message) });
    const status = message.startsWith("misconfigured") ? 500 : 400;
    return json({ error: safeMessage(message) }, status);
  }
});
