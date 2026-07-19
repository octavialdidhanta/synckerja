/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getTikTokSignatureHeader,
  resolveWebhookNotificationId,
  TIKTOK_SHOP_CS_NEW_CONVERSATION_TYPE,
  TIKTOK_SHOP_CS_NEW_MESSAGE_TYPE,
  verifyTikTokShopWebhookSignature,
  type TikTokShopCsWebhookPayload,
} from "../_shared/tiktokShopWebhook.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, tiktok-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const SOFT_RATE_LIMIT = 120;
const SOFT_RATE_WINDOW_MS = 30 * 60 * 1000;

type ShopAccount = {
  id: string;
  organization_id: string;
  shop_id: string;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function softRateLimitAudit(
  admin: SupabaseClient,
  shopId: string,
): Promise<void> {
  try {
    const { data: accounts } = await admin
      .from("organization_tiktok_shop_accounts")
      .select("id, organization_id")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .limit(1);
    const account = (accounts ?? [])[0] as
      | { id: string; organization_id: string }
      | undefined;
    if (!account?.organization_id) return;

    const windowStartIso = new Date(Date.now() - SOFT_RATE_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("tiktok_shop_cs_api_calls")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", account.organization_id)
      .eq("action", "webhook")
      .gte("created_at", windowStartIso);
    if ((count ?? 0) >= SOFT_RATE_LIMIT) {
      console.warn("[tiktok-shop-webhook] soft rate limit exceeded", {
        organization_id: account.organization_id,
        count,
      });
    }
    await admin.from("tiktok_shop_cs_api_calls").insert({
      organization_id: account.organization_id,
      account_id: account.id,
      shop_id: shopId,
      action: "webhook",
    });
  } catch (e) {
    console.warn("[tiktok-shop-webhook] soft rate limit audit failed", e);
  }
}

async function resolveActiveAccount(
  admin: SupabaseClient,
  shopId: string,
): Promise<{ account: ShopAccount | null; error: string | null }> {
  const { data: accountRows, error: accountErr } = await admin
    .from("organization_tiktok_shop_accounts")
    .select("id, organization_id, shop_id")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .limit(1);

  if (accountErr) {
    return { account: null, error: accountErr.message };
  }
  const account = (accountRows ?? [])[0] as ShopAccount | undefined;
  return { account: account ?? null, error: null };
}

async function insertEvent(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ duplicate: boolean; error: string | null }> {
  const { error } = await admin.from("tiktok_shop_cs_webhook_events").insert(row);
  if (!error) return { duplicate: false, error: null };
  if (error.code === "23505") return { duplicate: true, error: null };
  return { duplicate: false, error: error.message };
}

async function handleNewConversation(
  admin: SupabaseClient,
  payload: TikTokShopCsWebhookPayload,
  notificationId: string,
  shopId: string,
  account: ShopAccount,
): Promise<Response> {
  const data = payload.data ?? {};
  const conversationId = String(data.conversation_id ?? "").trim();
  const createTime = typeof data.create_time === "number" ? data.create_time : null;

  const eventResult = await insertEvent(admin, {
    tts_notification_id: notificationId,
    type: TIKTOK_SHOP_CS_NEW_CONVERSATION_TYPE,
    shop_id: shopId,
    organization_id: account.organization_id,
    account_id: account.id,
    payload,
    status: conversationId ? "processed" : "skipped",
  });
  if (eventResult.duplicate) return json({ ok: true, status: "duplicate" });
  if (eventResult.error) {
    console.error("[tiktok-shop-webhook] event insert failed", eventResult.error);
    return json({ ok: true, status: "error", reason: "event_insert" });
  }

  if (!conversationId) {
    return json({ ok: true, status: "skipped", reason: "missing_conversation_id" });
  }

  const nowIso = new Date().toISOString();
  const { error: upsertErr } = await admin.from("tiktok_shop_cs_conversations").upsert(
    {
      organization_id: account.organization_id,
      account_id: account.id,
      shop_id: shopId,
      conversation_id: conversationId,
      create_time: createTime,
      tts_notification_id: notificationId,
      raw: payload,
      updated_at: nowIso,
    },
    { onConflict: "account_id,conversation_id" },
  );

  if (upsertErr) {
    console.error("[tiktok-shop-webhook] conversation upsert failed", upsertErr.message);
    return json({ ok: true, status: "error", reason: "conversation_upsert" });
  }

  return json({ ok: true, status: "processed", type: TIKTOK_SHOP_CS_NEW_CONVERSATION_TYPE });
}

async function handleNewMessage(
  admin: SupabaseClient,
  payload: TikTokShopCsWebhookPayload,
  notificationId: string,
  shopId: string,
  account: ShopAccount,
): Promise<Response> {
  const data = payload.data ?? {};
  const messageId = String(data.message_id ?? "").trim();
  const conversationId = String(data.conversation_id ?? "").trim();
  const isVisible = data.is_visible !== false;

  const eventResult = await insertEvent(admin, {
    tts_notification_id: notificationId,
    type: TIKTOK_SHOP_CS_NEW_MESSAGE_TYPE,
    shop_id: shopId,
    organization_id: account.organization_id,
    account_id: account.id,
    payload,
    status: !messageId || !conversationId || !isVisible ? "skipped" : "processed",
  });
  if (eventResult.duplicate) return json({ ok: true, status: "duplicate" });
  if (eventResult.error) {
    console.error("[tiktok-shop-webhook] event insert failed", eventResult.error);
    return json({ ok: true, status: "error", reason: "event_insert" });
  }

  if (!messageId || !conversationId || !isVisible) {
    return json({
      ok: true,
      status: "skipped",
      reason: !isVisible ? "not_visible" : "missing_message_fields",
    });
  }

  const sender = data.sender ?? {};
  const { error: msgErr } = await admin.from("tiktok_shop_cs_messages").insert({
    organization_id: account.organization_id,
    account_id: account.id,
    shop_id: shopId,
    conversation_id: conversationId,
    message_id: messageId,
    message_type: data.type != null ? String(data.type) : null,
    content: data.content != null ? String(data.content) : null,
    sender_im_user_id: sender.im_user_id != null ? String(sender.im_user_id) : null,
    sender_role: sender.role != null ? String(sender.role) : null,
    is_visible: true,
    message_index: data.index != null ? String(data.index) : null,
    create_time: typeof data.create_time === "number" ? data.create_time : null,
    tts_notification_id: notificationId,
    raw: payload,
  });

  if (msgErr && msgErr.code !== "23505") {
    console.error("[tiktok-shop-webhook] message insert failed", msgErr.message);
    return json({ ok: true, status: "error", reason: "message_insert" });
  }

  return json({ ok: true, status: "processed", type: TIKTOK_SHOP_CS_NEW_MESSAGE_TYPE });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json({ ok: true, service: "tiktok-shop-webhook" });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const appSecret = Deno.env.get("TIKTOK_SHOP_APP_SECRET")?.trim() ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("[tiktok-shop-webhook] Missing Supabase env");
    return json({ error: "Server misconfigured" }, 500);
  }

  const rawBody = await req.text();
  const signatureHeader = getTikTokSignatureHeader(req);
  const verified = await verifyTikTokShopWebhookSignature(
    rawBody,
    signatureHeader,
    appSecret,
  );
  if (!verified.ok) {
    console.warn("[tiktok-shop-webhook] signature rejected", verified.reason, {
      hasHeader: Boolean(signatureHeader),
      headerNames: [...req.headers.keys()],
    });
    return json({ error: "Invalid signature", code: "INVALID_SIGNATURE" }, 401);
  }

  let payload: TikTokShopCsWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TikTokShopCsWebhookPayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const notificationId = resolveWebhookNotificationId(payload);
  const shopId = String(payload.shop_id ?? "").trim();
  const eventType = Number(payload.type);

  if (shopId) {
    await softRateLimitAudit(admin, shopId);
  }

  if (!notificationId) {
    console.warn("[tiktok-shop-webhook] missing tts_notification_id");
    return json({ ok: true, status: "skipped", reason: "missing_notification_id" });
  }

  const { data: existing } = await admin
    .from("tiktok_shop_cs_webhook_events")
    .select("id")
    .eq("tts_notification_id", notificationId)
    .maybeSingle();
  if (existing?.id) {
    return json({ ok: true, status: "duplicate" });
  }

  const isSupported =
    eventType === TIKTOK_SHOP_CS_NEW_CONVERSATION_TYPE ||
    eventType === TIKTOK_SHOP_CS_NEW_MESSAGE_TYPE;

  if (!isSupported) {
    await insertEvent(admin, {
      tts_notification_id: notificationId,
      type: Number.isFinite(eventType) ? eventType : null,
      shop_id: shopId || null,
      payload,
      status: "skipped",
    });
    return json({ ok: true, status: "skipped", reason: "unsupported_type" });
  }

  if (!shopId) {
    await insertEvent(admin, {
      tts_notification_id: notificationId,
      type: eventType,
      payload,
      status: "unknown_shop",
    });
    return json({ ok: true, status: "unknown_shop" });
  }

  const { account, error: accountErr } = await resolveActiveAccount(admin, shopId);
  if (accountErr) {
    console.error("[tiktok-shop-webhook] account lookup failed", accountErr);
    return json({ ok: true, status: "error", reason: "account_lookup" });
  }
  if (!account) {
    await insertEvent(admin, {
      tts_notification_id: notificationId,
      type: eventType,
      shop_id: shopId,
      payload,
      status: "unknown_shop",
    });
    return json({ ok: true, status: "unknown_shop" });
  }

  if (eventType === TIKTOK_SHOP_CS_NEW_CONVERSATION_TYPE) {
    return handleNewConversation(admin, payload, notificationId, shopId, account);
  }

  return handleNewMessage(admin, payload, notificationId, shopId, account);
});
