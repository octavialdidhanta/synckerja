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

async function sendFcmMessage(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ ok: boolean; status?: number }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  // Data-only on Android so SynckerjaFirebaseMessagingService posts ic_notification_large (pwa-512).
  const dataWithAlert = Object.fromEntries(
    Object.entries({ ...data, title, body, channel_id: "notifications" }).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        data: dataWithAlert,
        android: { priority: "high" },
        apns: { payload: { aps: { alert: { title, body }, sound: "default" } } },
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
  organization_id: string;
  recipient_user_id: string;
  created_at: string;
  event_type: "assign" | "unassign" | "reassign";
  entity_type: "task" | "step" | "substep";
  title: string;
  due_date: string | null;
  url: string;
};

function buildAssignmentPushContent(rows: ClaimedRow[]): { title: string; body: string } {
  const latest = rows[0];
  const total = rows.length;
  const itemTitle = latest.title || "Item";
  const eventTypes = new Set(rows.map((row) => row.event_type));
  const singleEvent = eventTypes.size === 1 ? [...eventTypes][0] : null;

  if (total === 1) {
    if (latest.event_type === "unassign") {
      return {
        title: "Daily Task",
        body: `Penugasan dicabut: ${itemTitle}`,
      };
    }
    if (latest.event_type === "reassign") {
      return {
        title: "Daily Task",
        body: `Ditugaskan ulang: ${itemTitle}`,
      };
    }
    return {
      title: "Daily Task",
      body: `Ditugaskan: ${itemTitle}`,
    };
  }

  if (singleEvent === "unassign") {
    return {
      title: "Daily Task",
      body: `${total} penugasan dicabut dari Anda`,
    };
  }
  if (singleEvent === "reassign") {
    return {
      title: "Daily Task",
      body: `${total} penugasan diubah`,
    };
  }
  if (singleEvent === "assign") {
    return {
      title: "Daily Task",
      body: `${total} penugasan baru ditugaskan ke Anda`,
    };
  }

  return {
    title: "Daily Task",
    body: `${total} pembaruan penugasan Daily Task`,
  };
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
    if (payload?.type !== "INSERT" || payload?.table !== "daily_task_assignment_push_queue") {
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
      console.log("daily-task-assignment-send-push: skipped no_fcm_secret");
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

    // Claim (batch) unsent rows for this recipient in a short window.
    const { data: claimed, error: claimErr } = await supabase.rpc(
      "claim_daily_task_assignment_push_queue",
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

    const latest = rows[0];
    const total = rows.length;
    const { title, body } = buildAssignmentPushContent(rows);

    const { data: fcmRows } = await supabase
      .from("fcm_tokens")
      .select("id, token")
      .eq("user_id", recipientUserId)
      .eq("context", "general");
    const tokens = (fcmRows ?? []) as { id: string; token: string }[];
    if (tokens.length === 0) {
      console.log("daily-task-assignment-send-push: no_tokens", { recipientUserId, total });
      return new Response(JSON.stringify({ ok: true, skipped: "no_tokens", claimed: total }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getFcmAccessToken(fcmServiceAccountJson);
    const dataPayload: Record<string, string> = {
      notificationType: "daily_task_assignment",
      eventType: latest.event_type,
      url: latest.url || "/tools/daily-task",
      badge: String(total),
    };

    let sent = 0;
    for (const t of tokens) {
      const res = await sendFcmMessage(accessToken, projectId, t.token, title, body, dataPayload);
      if (res.ok) {
        sent++;
        break; // one successful delivery is enough
      }
    }

    console.log("daily-task-assignment-send-push: done", { recipientUserId, claimed: total, sent });
    return new Response(JSON.stringify({ ok: true, claimed: total, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-task-assignment-send-push error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

