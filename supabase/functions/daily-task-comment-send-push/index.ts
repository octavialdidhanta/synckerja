/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type CommentClaimedRow = {
  id: string;
  recipient_user_id: string;
  event_type: "comment" | "reply" | "mention" | "reaction";
  title: string;
  body_preview: string;
  url: string;
};

type AssignmentClaimedRow = {
  id: string;
  recipient_user_id: string;
  event_type: "assign" | "unassign" | "reassign";
  title: string;
  url: string;
};

function buildCommentBody(latest: CommentClaimedRow, total: number): string {
  if (total === 1) {
    const preview = (latest.body_preview || "").trim();
    if (latest.event_type === "reaction") return preview || "New reaction on a step comment";
    if (latest.event_type === "mention") return preview ? `Mentioned you: ${preview}` : "You were mentioned in a step comment";
    if (latest.event_type === "reply") return preview ? `Reply: ${preview}` : "New reply on a step comment";
    return preview ? `Comment: ${preview}` : "New comment on a task step";
  }
  return `${total} new step comment updates`;
}

function buildAssignmentPushContent(rows: AssignmentClaimedRow[]): { title: string; body: string } {
  const latest = rows[0];
  const total = rows.length;
  const itemTitle = latest.title || "Item";
  const eventTypes = new Set(rows.map((row) => row.event_type));
  const singleEvent = eventTypes.size === 1 ? [...eventTypes][0] : null;

  if (total === 1) {
    if (latest.event_type === "unassign") {
      return { title: "Daily Task", body: `Penugasan dicabut: ${itemTitle}` };
    }
    if (latest.event_type === "reassign") {
      return { title: "Daily Task", body: `Ditugaskan ulang: ${itemTitle}` };
    }
    return { title: "Daily Task", body: `Ditugaskan: ${itemTitle}` };
  }

  if (singleEvent === "unassign") {
    return { title: "Daily Task", body: `${total} penugasan dicabut dari Anda` };
  }
  if (singleEvent === "reassign") {
    return { title: "Daily Task", body: `${total} penugasan diubah` };
  }
  if (singleEvent === "assign") {
    return { title: "Daily Task", body: `${total} penugasan baru ditugaskan ke Anda` };
  }

  return { title: "Daily Task", body: `${total} pembaruan penugasan Daily Task` };
}

async function deliverFcmPush(
  supabase: SupabaseClient,
  recipientUserId: string,
  title: string,
  body: string,
  dataPayload: Record<string, string>,
  fcmServiceAccountJson: string,
  projectId: string,
  logPrefix: string,
  claimed: number,
): Promise<Response> {
  const { data: fcmRows } = await supabase
    .from("fcm_tokens")
    .select("id, token")
    .eq("user_id", recipientUserId)
    .eq("context", "general");
  const tokens = (fcmRows ?? []) as { id: string; token: string }[];
  if (tokens.length === 0) {
    console.log(`${logPrefix}: no_tokens`, { recipientUserId, claimed });
    return new Response(JSON.stringify({ ok: true, skipped: "no_tokens", claimed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const accessToken = await getFcmAccessToken(fcmServiceAccountJson);
  let sent = 0;
  for (const t of tokens) {
    const res = await sendFcmMessage(accessToken, projectId, t.token, title, body, dataPayload);
    if (res.ok) {
      sent++;
      break;
    }
  }

  console.log(`${logPrefix}: done`, { recipientUserId, claimed, sent });
  return new Response(JSON.stringify({ ok: true, claimed, sent }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleAssignmentPush(
  supabase: SupabaseClient,
  recipientUserId: string,
  fcmServiceAccountJson: string,
  projectId: string,
): Promise<Response> {
  const { data: claimed, error: claimErr } = await supabase.rpc(
    "claim_daily_task_assignment_push_queue",
    {
      p_recipient_user_id: recipientUserId,
      p_window_seconds: 20,
      p_max: 25,
    },
  );
  if (claimErr) throw claimErr;
  const rows = (claimed ?? []) as AssignmentClaimedRow[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: "nothing_to_send" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const latest = rows[0];
  const { title, body } = buildAssignmentPushContent(rows);
  return deliverFcmPush(
    supabase,
    recipientUserId,
    title,
    body,
    {
      notificationType: "daily_task_assignment",
      eventType: latest.event_type,
      url: latest.url || "/tools/daily-task",
      badge: String(rows.length),
    },
    fcmServiceAccountJson,
    projectId,
    "daily-task-comment-send-push:assignment",
    rows.length,
  );
}

async function handleCommentPush(
  supabase: SupabaseClient,
  recipientUserId: string,
  fcmServiceAccountJson: string,
  projectId: string,
): Promise<Response> {
  const { data: claimed, error: claimErr } = await supabase.rpc(
    "claim_task_step_comment_push_queue",
    {
      p_recipient_user_id: recipientUserId,
      p_window_seconds: 20,
      p_max: 25,
    },
  );
  if (claimErr) throw claimErr;
  const rows = (claimed ?? []) as CommentClaimedRow[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: "nothing_to_send" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const latest = rows[0];
  const total = rows.length;
  const title = latest.title ? `Step: ${latest.title}` : "Daily Task";
  const body = buildCommentBody(latest, total);

  return deliverFcmPush(
    supabase,
    recipientUserId,
    title,
    body,
    {
      notificationType: "daily_task_step_comment",
      url: latest.url || "/tools/daily-task",
      badge: String(total),
    },
    fcmServiceAccountJson,
    projectId,
    "daily-task-comment-send-push:comment",
    total,
  );
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
    const isCommentQueue =
      payload?.type === "INSERT" && table === "task_step_comment_push_queue";
    const isAssignmentQueue =
      payload?.type === "INSERT" && table === "daily_task_assignment_push_queue";

    if (!isCommentQueue && !isAssignmentQueue) {
      return new Response(JSON.stringify({ ok: true, skipped: "not_supported_queue_insert" }), {
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
      console.log("daily-task-comment-send-push: skipped no_fcm_secret");
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

    if (isAssignmentQueue) {
      return await handleAssignmentPush(supabase, recipientUserId, fcmServiceAccountJson, projectId);
    }

    return await handleCommentPush(supabase, recipientUserId, fcmServiceAccountJson, projectId);
  } catch (e) {
    console.error("daily-task-comment-send-push error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
