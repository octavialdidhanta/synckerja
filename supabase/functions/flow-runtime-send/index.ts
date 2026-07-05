/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFlowWhatsAppMessage } from "../_shared/omnichannelFlow/flowRuntimeSendMessage.ts";
import { omnichannelFlowCorsHeaders, omnichannelFlowJson } from "../_shared/omnichannelFlow/omnichannelFlowAuth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: omnichannelFlowCorsHeaders });
  }

  if (req.method !== "POST") {
    return omnichannelFlowJson({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token || token !== serviceRoleKey) {
      return omnichannelFlowJson({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));

    const result = await sendFlowWhatsAppMessage(admin, body);
    if (!result.ok) {
      return omnichannelFlowJson({ error: result.error ?? "Send failed" }, result.error === "Conversation not found" ? 404 : 502);
    }

    return omnichannelFlowJson({ ok: true, wa_message_id: result.waMessageId }, 200);
  } catch (err) {
    console.error("flow-runtime-send error:", err);
    return omnichannelFlowJson({ error: String(err) }, 500);
  }
});
