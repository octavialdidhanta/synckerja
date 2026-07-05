/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeAutomationFlowRuntime } from "../_shared/omnichannelFlow/graphExecutor.ts";
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

    await executeAutomationFlowRuntime(admin, {
      organizationId: String(body.organization_id ?? body.organizationId ?? ""),
      conversationId: String(body.conversation_id ?? body.conversationId ?? ""),
      messageId: String(body.message_id ?? body.messageId ?? ""),
      messageBody: String(body.message_body ?? body.messageBody ?? ""),
      phoneNumberId: body.phone_number_id ?? body.phoneNumberId ?? null,
      customerWaId: String(body.customer_wa_id ?? body.customerWaId ?? ""),
      customerName: body.customer_name ?? body.customerName ?? null,
      isResumeFromWait: Boolean(body.is_resume_from_wait ?? body.isResumeFromWait),
      replyId: body.reply_id ?? body.replyId ?? null,
    });

    return omnichannelFlowJson({ ok: true }, 200);
  } catch (err) {
    console.error("flow-runtime error:", err);
    return omnichannelFlowJson({ error: String(err) }, 500);
  }
});
