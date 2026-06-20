/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  processThreadsLivechatWebhook,
  resolveThreadsAccountForWebhook,
  type ThreadsWebhookPayload,
} from "../_shared/threadsLivechatWebhook.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type LivechatPushTable =
  | "whatsapp_messages"
  | "instagram_messages"
  | "facebook_messages"
  | "email_messages"
  | "threads_messages";

function livechatPushUsesDatabaseWebhookOnly(): boolean {
  return Deno.env.get("LIVECHAT_USE_DATABASE_WEBHOOK_FOR_PUSH") === "true";
}

async function notifyLivechatInboundPush(
  table: LivechatPushTable,
  record: Record<string, unknown>,
): Promise<void> {
  if (livechatPushUsesDatabaseWebhookOnly()) return;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("notifyLivechatInboundPush: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/livechat-send-push`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        type: "INSERT",
        table,
        schema: "public",
        record,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("notifyLivechatInboundPush: livechat-send-push HTTP error", res.status, t.slice(0, 800));
    }
  } catch (e) {
    console.error("notifyLivechatInboundPush: fetch failed", e);
  }
}

async function verifyThreadsWebhookToken(
  supabase: ReturnType<typeof createClient>,
  token: string,
): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed) return false;

  const { data: byThreadsToken } = await supabase
    .from("organization_instagram_accounts")
    .select("id")
    .eq("threads_verify_token", trimmed)
    .eq("is_active", true)
    .eq("has_threads", true)
    .maybeSingle();
  if (byThreadsToken) return true;

  const { data: byVerifyToken } = await supabase
    .from("organization_instagram_accounts")
    .select("id")
    .eq("verify_token", trimmed)
    .eq("is_active", true)
    .eq("has_threads", true)
    .maybeSingle();
  if (byVerifyToken) return true;

  const { data: metaByVerify } = await supabase
    .from("organization_meta_config")
    .select("id")
    .eq("verify_token", trimmed)
    .eq("is_active", true)
    .maybeSingle();
  if (metaByVerify) return true;

  return false;
}

function normalizeWebhookPayload(body: Record<string, unknown>): ThreadsWebhookPayload[] {
  const payloads: ThreadsWebhookPayload[] = [];

  // Meta Threads flat payload (documented sample).
  if (body.values && typeof body.values === "object") {
    payloads.push(body as ThreadsWebhookPayload);
    return payloads;
  }

  // Batch array at root (some Meta deliveries).
  if (Array.isArray(body)) {
    for (const item of body) {
      if (item && typeof item === "object") {
        payloads.push(...normalizeWebhookPayload(item as Record<string, unknown>));
      }
    }
    return payloads;
  }

  const entries = body.entry;
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      const e = entry as Record<string, unknown>;
      const changes = e.changes;
      if (!Array.isArray(changes)) continue;
      for (const ch of changes) {
        const change = ch as Record<string, unknown>;
        payloads.push({
          target_id: e.id,
          topic: body.topic,
          time: e.time ?? body.time,
          values: {
            field: change.field,
            value: change.value as Record<string, unknown>,
          },
        });
      }
    }
  }

  return payloads;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  console.log("[threads-webhook] ENTRY", req.method, url.pathname);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode !== "subscribe" || !challenge) {
        return new Response("threads-webhook ok", {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      const verified = token ? await verifyThreadsWebhookToken(supabase, token) : false;
      if (!verified) {
        console.error("[threads-webhook] GET: verify_token not found");
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }

      console.log("[threads-webhook] GET: verification success");
      return new Response(String(challenge), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json().catch((e) => {
      console.error("[threads-webhook] POST body parse error", e);
      return {};
    });

    const body = (Array.isArray(rawBody) ? { __batch: rawBody } : rawBody) as Record<string, unknown>;
    if (Array.isArray(rawBody)) {
      console.log("[threads-webhook] POST batch length", rawBody.length);
    } else {
      console.log("[threads-webhook] POST keys", Object.keys(body).join(", "));
    }

    const payloads = Array.isArray(rawBody)
      ? rawBody.flatMap((item) =>
        item && typeof item === "object"
          ? normalizeWebhookPayload(item as Record<string, unknown>)
          : []
      )
      : normalizeWebhookPayload(body);
    if (payloads.length === 0) {
      console.log("[threads-webhook] POST: no supported payloads", {
        keys: Object.keys(body).join(", "),
      });
      return new Response(JSON.stringify({ success: true, processed: 0, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ensuredLivechatStatusOrgs = new Set<string>();
    let processedCount = 0;

    for (const payload of payloads) {
      const field = payload.values?.field != null ? String(payload.values.field) : "";
      console.log("[threads-webhook] event", {
        field,
        topic: payload.topic,
        target_id: payload.target_id,
      });

      const account = await resolveThreadsAccountForWebhook(supabase, payload);
      if (!account) {
        console.error("[threads-webhook] account not found for payload target", payload.target_id);
        continue;
      }

      const ok = await processThreadsLivechatWebhook(
        supabase,
        account,
        payload,
        async (record) => notifyLivechatInboundPush("threads_messages", record),
        ensuredLivechatStatusOrgs,
      );
      if (ok) processedCount += 1;
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[threads-webhook] error", err);
    return new Response(JSON.stringify({ error: "Webhook failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
