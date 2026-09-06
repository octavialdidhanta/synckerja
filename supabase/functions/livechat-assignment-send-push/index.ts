/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const APP_ORIGIN = Deno.env.get("LIVECHAT_APP_ORIGIN") ?? "";

type DbWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
};

function ticketIdFromConversationId(conversationId: string): string {
  return "WA-" + String(conversationId).replace(/-/g, "").slice(0, 8).toUpperCase();
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
): Promise<{ ok: boolean; status?: number; errorBody?: string }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  // Data-only on Android so SynckerjaFirebaseMessagingService posts ic_notification_large (pwa-512).
  const dataWithAlert = Object.fromEntries(
    Object.entries({ ...data, title, body, channel_id: "livechat" }).map(([k, v]) => [k, String(v)]),
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
        apns: {
          payload: { aps: { alert: { title, body }, sound: "default" } },
        },
      },
    }),
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
    const oldRecord = payload?.old_record ?? {};

    if (payload?.type !== "UPDATE" || table !== "whatsapp_conversations") {
      console.log("livechat-assignment-send-push: skipped", { table, type: payload?.type });
      return new Response(JSON.stringify({ ok: true, skipped: "not_update_or_unknown_table" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newAssigneeEmployeeId = (record.assignee_id as string | null | undefined) ?? null;
    const oldAssigneeEmployeeId = (oldRecord.assignee_id as string | null | undefined) ?? null;

    if (newAssigneeEmployeeId === oldAssigneeEmployeeId) {
      return new Response(JSON.stringify({ ok: true, skipped: "assignee_unchanged" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conversationId = (record.id as string | undefined) ?? "";
    if (!conversationId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_conversation_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = (record.organization_id as string | undefined) ?? "";
    const customerName = (record.customer_name as string | null | undefined) ?? "Customer";
    const ticketId = (record.ticket_id as string | null | undefined) ?? ticketIdFromConversationId(conversationId);

    const actorUserId = (record.last_assigned_by_user_id as string | null | undefined) ?? null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const employeeIds = [newAssigneeEmployeeId, oldAssigneeEmployeeId].filter((x): x is string => Boolean(x));
    const uniqueEmployeeIds = [...new Set(employeeIds)];

    const { data: employees } = await supabase
      .from("employees")
      .select("id, user_id")
      .in("id", uniqueEmployeeIds);

    const employeeToUser = new Map<string, string>();
    (employees ?? []).forEach((e: { id: string; user_id: string | null }) => {
      if (e?.id && e.user_id) employeeToUser.set(e.id, e.user_id);
    });

    const newAssigneeUserId = newAssigneeEmployeeId ? employeeToUser.get(newAssigneeEmployeeId) ?? null : null;
    const oldAssigneeUserId = oldAssigneeEmployeeId ? employeeToUser.get(oldAssigneeEmployeeId) ?? null : null;

    const recipients = [
      { kind: "new" as const, userId: newAssigneeUserId },
      { kind: "old" as const, userId: oldAssigneeUserId },
    ].filter((r) => Boolean(r.userId));

    if (recipients.length === 0) {
      console.log("livechat-assignment-send-push: skipped no_recipients", {
        conversationId,
        newAssigneeEmployeeId,
        oldAssigneeEmployeeId,
      });
      return new Response(JSON.stringify({ ok: true, skipped: "no_recipients" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcmSa = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "";
    if (!fcmSa) {
      console.log("livechat-assignment-send-push: skipped no_fcm_secret");
      return new Response(JSON.stringify({ ok: true, skipped: "no_fcm_secret" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const projectId = Deno.env.get("FCM_PROJECT_ID") ?? (JSON.parse(fcmSa) as { project_id?: string }).project_id ?? "";
    if (!projectId) throw new Error("FCM projectId missing");

    const accessToken = await getFcmAccessToken(fcmSa);

    const deepUrl = `${APP_ORIGIN || ""}/omnichannel/livechat?conversation=${encodeURIComponent(conversationId)}`;
    const dataPayloadBase: Record<string, string> = {
      notificationType: "livechat_assignment",
      url: deepUrl.startsWith("http") ? deepUrl : `/omnichannel/livechat?conversation=${conversationId}`,
      organization_id: organizationId,
      conversation_id: conversationId,
      ticket_id: ticketId,
    };

    const title = String(customerName).trim() || "Customer";

    let fcmSent = 0;
    for (const r of recipients) {
      const userId = r.userId as string;

      // Skip self-assign notification to the assignee (actor == assignee)
      if (r.kind === "new" && actorUserId && actorUserId === userId) {
        continue;
      }

      const { data: tokens } = await supabase
        .from("fcm_tokens")
        .select("token")
        .eq("user_id", userId)
        .eq("context", "livechat")
        .eq("app_id", "id.synckerja.app");

      const tokenList = (tokens ?? [])
        .map((t: { token: string | null }) => (t.token ?? "").trim())
        .filter((t: string) => t.length > 0);
      if (tokenList.length === 0) continue;

      const body =
        r.kind === "new"
          ? "Chat baru ditugaskan ke Anda"
          : "Chat Anda dialihkan ke agen lain";

      for (const fcmToken of tokenList) {
        const res = await sendFcmMessage(accessToken, projectId, fcmToken, title, body, dataPayloadBase);
        if (res.ok) fcmSent += 1;
        else {
          console.error("livechat-assignment-send-push: FCM send failed", { status: res.status, errorBody: res.errorBody?.slice(0, 500) });
        }
      }
    }

    console.log("livechat-assignment-send-push: done", {
      conversationId,
      newAssigneeEmployeeId,
      oldAssigneeEmployeeId,
      fcmSent,
    });

    return new Response(JSON.stringify({ ok: true, fcmSent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("livechat-assignment-send-push error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

