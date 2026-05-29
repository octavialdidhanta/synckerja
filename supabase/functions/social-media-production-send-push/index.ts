/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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
  const b64 = (b: Uint8Array) =>
    btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(signatureInput));
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
  if (!tokenRes.ok) throw new Error(`FCM token failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new Error("No access_token");
  return tokenData.access_token;
}

const PUBLIC_APP_ORIGIN = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://app.profitloop.id";

async function sendFcmMessage(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ ok: boolean; status?: number }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const notification: { title: string; body: string; image?: string } = { title, body };
  notification.image = `${PUBLIC_APP_ORIGIN}/splash-logo.png`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification,
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        android: {
          priority: "high",
          notification: { channel_id: "notifications", sound: "default", icon: "app_brand_logo" },
        },
        apns: { payload: { aps: { sound: "default" } } },
      },
    }),
  });
  return res.ok ? { ok: true } : { ok: false, status: res.status };
}

type DbWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
  old_record?: unknown;
};

type ClaimedRow = {
  id: string;
  recipient_user_id: string;
  event_type: "approved" | "revision_requested" | "revision_submitted";
  plan_title: string;
  url: string;
  review_token: string | null;
  social_media_plan_id: string;
};

function pushCopyForEvent(
  eventType: ClaimedRow["event_type"],
  planTitle: string,
): { title: string; body: string } {
  const label = (planTitle && planTitle.trim()) || "Konten";
  switch (eventType) {
    case "approved":
      return {
        title: "Konten disetujui",
        body: `${label} telah di-approve. Silakan lanjutkan posting/produksi.`,
      };
    case "revision_requested":
      return {
        title: "Permintaan revisi",
        body: `${label} perlu revisi. Cek komentar di review link.`,
      };
    case "revision_submitted":
      return {
        title: "Revisi siap direview",
        body: `${label} sudah dikirim ulang untuk review.`,
      };
    default:
      return { title: "Produksi konten", body: label };
  }
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
    if (payload?.type !== "INSERT" || payload?.table !== "social_media_production_push_queue") {
      return new Response(JSON.stringify({ ok: true, skipped: "not_queue_insert" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const record = payload.record ?? {};
    const recipientUserId = (record.recipient_user_id as string | undefined) ?? "";
    if (!recipientUserId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_recipient" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "";
    if (!fcmServiceAccountJson) {
      console.log("social-media-production-send-push: skipped no_fcm_secret");
      return new Response(JSON.stringify({ ok: true, skipped: "no_fcm_secret" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const projectId =
      Deno.env.get("FCM_PROJECT_ID") ??
      (JSON.parse(fcmServiceAccountJson) as { project_id?: string }).project_id ??
      "";
    if (!projectId) throw new Error("FCM projectId missing");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: claimed, error: claimErr } = await supabase.rpc(
      "claim_social_media_production_push_queue",
      {
        p_recipient_user_id: recipientUserId,
        p_window_seconds: 20,
        p_max: 25,
      },
    );
    if (claimErr) throw claimErr;
    const rows = (claimed ?? []) as ClaimedRow[];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "nothing_to_send" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const total = rows.length;
    const latest = rows[0];
    const copy = pushCopyForEvent(latest.event_type, latest.plan_title);
    const title = total === 1 ? copy.title : "Produksi konten";
    const body =
      total === 1
        ? copy.body
        : `${total} pembaruan produksi konten — buka aplikasi untuk detail.`;

    const { data: fcmRows } = await supabase
      .from("fcm_tokens")
      .select("id, token")
      .eq("user_id", recipientUserId)
      .eq("context", "general");
    const tokens = (fcmRows ?? []) as { id: string; token: string }[];
    if (tokens.length === 0) {
      console.log("social-media-production-send-push: no_tokens", { recipientUserId, total });
      return new Response(JSON.stringify({ ok: true, skipped: "no_tokens", claimed: total }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getFcmAccessToken(fcmServiceAccountJson);
    const dataPayload: Record<string, string> = {
      notificationType: "social_media_production_review",
      url: latest.url || "/digital-marketing/social-media/dashboard",
      badge: String(total),
      event_type: latest.event_type,
      social_media_plan_id: latest.social_media_plan_id,
    };
    if (latest.review_token) {
      dataPayload.review_token = latest.review_token;
    }

    let sent = 0;
    for (const t of tokens) {
      const res = await sendFcmMessage(accessToken, projectId, t.token, title, body, dataPayload);
      if (res.ok) {
        sent++;
        break;
      }
    }

    console.log("social-media-production-send-push: done", { recipientUserId, claimed: total, sent });
    return new Response(JSON.stringify({ ok: true, claimed: total, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("social-media-production-send-push error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
