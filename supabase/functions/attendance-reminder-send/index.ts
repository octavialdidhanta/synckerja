/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
    ["sign"]
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
  data: Record<string, string>
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
          notification: { channel_id: "notifications", sound: "default", icon: "splash_white_logo" },
        },
        apns: { payload: { aps: { sound: "default" } } },
      },
    }),
  });
  return res.ok ? { ok: true } : { ok: false, status: res.status };
}

const TITLE = "Pengingat Absen";
const TEMPLATE_BEFORE = "{{userName}}, jam kerja {{scheduleName}} dimulai pukul {{startTime}}. Segera lakukan absen.";
const TEMPLATE_AFTER = "{{userName}}, Anda belum melakukan absen untuk {{scheduleName}} (mulai {{startTime}}). Silakan lakukan absen.";

function formatStartTime(startTime: string): string {
  const parts = startTime.trim().split(":");
  const h = (parts[0] ?? "0").padStart(2, "0");
  const m = (parts[1] ?? "0").padStart(2, "0");
  return `${h}:${m}`;
}

function buildBody(
  reminderType: string,
  userName: string,
  scheduleName: string,
  startTimeFormatted: string
): string {
  const before = reminderType === "before_30m" || reminderType === "before_15m";
  const t = before ? TEMPLATE_BEFORE : TEMPLATE_AFTER;
  return t
    .replace(/\{\{userName\}\}/g, userName)
    .replace(/\{\{scheduleName\}\}/g, scheduleName)
    .replace(/\{\{startTime\}\}/g, startTimeFormatted);
}

Deno.serve(async (req: Request) => {
  console.log("attendance-reminder-send: request", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceRoleKey || auth.slice(7) !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!fcmServiceAccountJson) {
    console.error("attendance-reminder-send: FCM_SERVICE_ACCOUNT_JSON not set");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sa = JSON.parse(fcmServiceAccountJson) as { project_id?: string };
  const projectId = sa.project_id ?? Deno.env.get("FCM_PROJECT_ID") ?? "";
  if (!projectId) {
    return new Response(JSON.stringify({ error: "FCM project id not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: rows, error: fetchError } = await supabase
    .from("attendance_reminder_queue")
    .select("id, user_id, employee_id, effective_date, schedule_name, start_time, reminder_type")
    .is("sent_at", null)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(200);

  if (fetchError) {
    console.error("attendance-reminder-send: fetch error", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pending = (rows ?? []) as {
    id: string;
    user_id: string;
    employee_id: string;
    effective_date: string;
    schedule_name: string;
    start_time: string;
    reminder_type: string;
  }[];

  if (pending.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, removedTokens: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const accessToken = await getFcmAccessToken(fcmServiceAccountJson);
  let sent = 0;
  const fcmToDelete: string[] = [];

  for (const row of pending) {
    const { data: existingAttendance } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("employee_id", row.employee_id)
      .eq("attendance_date", row.effective_date)
      .not("check_in_time", "is", null)
      .limit(1)
      .maybeSingle();
    if (existingAttendance) {
      await supabase
        .from("attendance_reminder_queue")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }

    const { data: empRow } = await supabase
      .from("employees")
      .select("full_name")
      .eq("id", row.employee_id)
      .single();
    const userName = (empRow as { full_name?: string } | null)?.full_name?.trim() ?? "Karyawan";
    const startTimeFormatted = formatStartTime(row.start_time);
    const body = buildBody(row.reminder_type, userName, row.schedule_name, startTimeFormatted);

    const { data: fcmRows } = await supabase
      .from("fcm_tokens")
      .select("id, token")
      .eq("user_id", row.user_id)
      .eq("context", "general");
    const tokens = (fcmRows ?? []) as { id: string; token: string }[];

    let delivered = false;
    for (const t of tokens) {
      const result = await sendFcmMessage(
        accessToken,
        projectId,
        t.token,
        TITLE,
        body,
        { url: "/", openNotifications: "true", notificationType: "attendance_reminder" }
      );
      if (result.ok) {
        delivered = true;
        sent++;
        break;
      }
      if (result.status === 404 || result.status === 400) fcmToDelete.push(t.id);
    }

    await supabase
      .from("attendance_reminder_queue")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  if (fcmToDelete.length > 0) {
    await supabase.from("fcm_tokens").delete().in("id", fcmToDelete);
  }

  console.log("attendance-reminder-send: done", { processed: pending.length, sent, removedTokens: fcmToDelete.length });
  return new Response(
    JSON.stringify({ ok: true, sent, processed: pending.length, removedTokens: fcmToDelete.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
