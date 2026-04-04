/// <reference path="../edge-runtime.d.ts" />
/// <reference path="./webpush.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const APP_ORIGIN = Deno.env.get("LIVECHAT_APP_ORIGIN") ?? "";
const VAPID_KEYS_ENV = "VAPID_KEYS";
const CONTACT_EMAIL = Deno.env.get("VAPID_CONTACT_EMAIL") ?? "mailto:support@example.com";

type DbWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
  old_record?: unknown;
};

function ticketIdFromConversationId(conversationId: string, table: string): string {
  const raw = String(conversationId).replace(/-/g, "").slice(0, 8).toUpperCase();
  if (table === "email_messages") return `EMAIL-${raw}`;
  if (table === "instagram_messages") return `IG-${raw}`;
  return `WA-${raw}`;
}

function previewText(body: string | null | undefined, maxLen: number): string {
  const s = (body ?? "").trim().replace(/\s+/g, " ");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "…";
}

function channelLabelFromTable(table: string): string {
  if (table === "whatsapp_messages") return "WhatsApp";
  if (table === "instagram_messages") return "Instagram";
  if (table === "email_messages") return "Email";
  return "Live Chat";
}

async function getFcmAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
    project_id?: string;
  };
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };
  const encoder = new TextEncoder();
  const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const headerB64 = b64(encoder.encode(JSON.stringify(header)));
  const payloadB64 = b64(encoder.encode(JSON.stringify(payload)));
  const signatureInput = `${headerB64}.${payloadB64}`;

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signatureInput)
  );
  const jwt = `${signatureInput}.${b64(new Uint8Array(sig))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`FCM token exchange failed: ${tokenRes.status} ${err}`);
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new Error("No access_token in FCM token response");
  return tokenData.access_token;
}

async function sendFcmMessage(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
  imageUrl?: string
): Promise<{ ok: boolean; status?: number; errorBody?: string }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const notification: { title: string; body: string; image?: string } = { title, body };
  if (imageUrl) notification.image = imageUrl;
  const bodyPayload = {
    message: {
      token: fcmToken,
      notification,
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: {
        notification: { channel_id: "livechat", sound: "default", icon: "splash_white_logo" },
      },
      apns: {
        payload: { aps: { sound: "default" } },
      },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(bodyPayload),
  });
  if (res.ok) return { ok: true };
  const errorBody = await res.text();
  return { ok: false, status: res.status, errorBody };
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

  try {
    const payload = (await req.json().catch(() => ({}))) as DbWebhookPayload;
    const table = payload?.table ?? "";
    const record = payload?.record ?? {};

    if (payload?.type !== "INSERT" || !["whatsapp_messages", "instagram_messages", "email_messages"].includes(table)) {
      console.log("livechat-send-push: skipped", { table, type: payload?.type });
      return new Response(JSON.stringify({ ok: true, skipped: "not_insert_or_unknown_table" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const direction = typeof record.direction === "string" ? record.direction : "";
    if (direction !== "inbound") {
      console.log("livechat-send-push: skipped not_inbound", { table });
      return new Response(JSON.stringify({ ok: true, skipped: "not_inbound" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conversationId = record.conversation_id as string | undefined;
    if (!conversationId) {
      console.log("livechat-send-push: skipped no_conversation_id", { table });
      return new Response(JSON.stringify({ ok: true, skipped: "no_conversation_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let organizationId: string;
    let senderName: string;
    let totalUnread: number = 1;
    const ticketId = ticketIdFromConversationId(conversationId, table);

    if (table === "whatsapp_messages") {
      const { data: conv, error: convErr } = await supabase
        .from("whatsapp_conversations")
        .select("organization_id, customer_name")
        .eq("id", conversationId)
        .single();
      if (convErr || !conv) {
        console.log("livechat-send-push: skipped conversation_not_found", { table, conversationId });
        return new Response(JSON.stringify({ ok: true, skipped: "conversation_not_found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      organizationId = (conv as { organization_id: string }).organization_id;
      senderName = ((conv as { customer_name?: string }).customer_name ?? "WhatsApp").trim() || "Customer";
    } else if (table === "instagram_messages") {
      const { data: conv, error: convErr } = await supabase
        .from("instagram_conversations")
        .select("organization_id, customer_name")
        .eq("id", conversationId)
        .single();
      if (convErr || !conv) {
        console.log("livechat-send-push: skipped conversation_not_found", { table, conversationId });
        return new Response(JSON.stringify({ ok: true, skipped: "conversation_not_found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      organizationId = (conv as { organization_id: string }).organization_id;
      senderName = ((conv as { customer_name?: string }).customer_name ?? "Instagram").trim() || "Customer";
    } else {
      const { data: conv, error: convErr } = await supabase
        .from("email_conversations")
        .select("organization_id, from_display_name, from_email")
        .eq("id", conversationId)
        .single();
      if (convErr || !conv) {
        console.log("livechat-send-push: skipped conversation_not_found", { table, conversationId });
        return new Response(JSON.stringify({ ok: true, skipped: "conversation_not_found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const c = conv as { organization_id: string; from_display_name?: string; from_email?: string };
      organizationId = c.organization_id;
      senderName = (c.from_display_name ?? c.from_email ?? "Email").trim() || "Customer";
    }

    const bodyText = (record.body as string) ?? (record.caption as string) ?? "";
    const bodyPreview = previewText(bodyText, 72);
    const channelLabel = channelLabelFromTable(table);
    const title = `[${channelLabel}] ${senderName}`;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("active_organization_id", organizationId);
    const userIds = (profiles ?? []).map((p: { user_id: string }) => p.user_id);
    if (userIds.length === 0) {
      console.log("livechat-send-push: skipped no_users_in_org", { organizationId });
      return new Response(JSON.stringify({ ok: true, skipped: "no_users_in_org" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = APP_ORIGIN || "https://app.profitloop.id";
    const url = `${baseUrl}/operations/consultant/all/livechat?ticket_id=${encodeURIComponent(ticketId)}`;

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    try {
      const [waRes, emailRes] = await Promise.all([
        supabase.rpc("get_whatsapp_unread_counts", { p_organization_id: organizationId }),
        supabase.rpc("get_email_unread_counts", { p_organization_id: organizationId }),
      ]);
      const sum = (rows: { unread_count?: number }[] | null) =>
        (rows ?? []).reduce((s, r) => s + (Number(r?.unread_count) || 0), 0);
      totalUnread = sum(waRes.data ?? []) + sum(emailRes.data ?? []);
      if (totalUnread < 1) totalUnread = 1;
    } catch {
      totalUnread = 1;
    }

    const toDelete: string[] = [];
    const subs = (subscriptions ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[];
    if (subs.length > 0) {
      const vapidKeysJson = Deno.env.get(VAPID_KEYS_ENV);
      if (!vapidKeysJson) {
        console.error("livechat-send-push: VAPID_KEYS secret not set");
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let vapidKeys: CryptoKeyPair;
      try {
        const exported = JSON.parse(vapidKeysJson) as { publicKey: JsonWebKey; privateKey: JsonWebKey };
        vapidKeys = await webpush.importVapidKeys(exported, { extractable: false });
      } catch (e) {
        console.error("livechat-send-push: invalid VAPID_KEYS", e);
        return new Response(JSON.stringify({ error: "Invalid VAPID keys" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const appServer = await webpush.ApplicationServer.new({
        contactInformation: CONTACT_EMAIL,
        vapidKeys,
      });
      const payloadStr = JSON.stringify({ title, body: bodyPreview, url, badge: totalUnread });
      for (const sub of subs) {
        try {
          const subscriber = appServer.subscribe({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          });
          await subscriber.pushTextMessage(payloadStr, { urgency: webpush.Urgency.High });
        } catch (err) {
          const res = err && typeof err === "object" && "response" in err ? (err as { response: Response }).response : null;
          if (res && (res.status === 410 || res.status === 404)) {
            toDelete.push(sub.id);
          } else {
            console.error("livechat-send-push: push failed", sub.endpoint?.slice(0, 50), err);
          }
        }
      }
      if (toDelete.length > 0) {
        await supabase.from("push_subscriptions").delete().in("id", toDelete);
      }
    }

    let fcmSent = 0;
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    const { data: fcmRows } = await supabase
      .from("fcm_tokens")
      .select("id, token")
      .in("user_id", userIds)
      .eq("context", "livechat");
    const fcmTokensList = (fcmRows ?? []) as { id: string; token: string }[];
    if (fcmServiceAccountJson && fcmTokensList.length > 0) {
      try {
        const sa = JSON.parse(fcmServiceAccountJson) as { project_id?: string };
        const projectId = sa.project_id ?? Deno.env.get("FCM_PROJECT_ID") ?? "";
        if (projectId) {
          const accessToken = await getFcmAccessToken(fcmServiceAccountJson);
          const fcmToDelete: string[] = [];
          const dataPayload = { url, ticket_id: ticketId, channel: table === "whatsapp_messages" ? "wa" : table === "instagram_messages" ? "ig" : "email" };
          for (const row of fcmTokensList) {
            const notificationImageUrl = (APP_ORIGIN || "https://app.profitloop.id") + "/splash-logo.png";
            const result = await sendFcmMessage(accessToken, projectId, row.token, title, bodyPreview, dataPayload, notificationImageUrl);
            if (result.ok) {
              fcmSent++;
            } else {
              if (result.status === 404 || result.status === 400) {
                fcmToDelete.push(row.id);
              }
            }
          }
          if (fcmToDelete.length > 0) {
            await supabase.from("fcm_tokens").delete().in("id", fcmToDelete);
          }
        }
      } catch (fcmErr) {
        console.error("livechat-send-push: FCM error", fcmErr);
      }
    }

    const sent = subs.length - toDelete.length;
    console.log("livechat-send-push: done", { table, webPushSent: sent, fcmSent, removed: toDelete.length, title });
    return new Response(
      JSON.stringify({ ok: true, sent: sent + fcmSent, webPushSent: sent, fcmSent, removed: toDelete.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("livechat-send-push error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
