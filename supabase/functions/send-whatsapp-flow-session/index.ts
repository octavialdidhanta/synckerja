/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertSenderIsActiveAssignee,
  ensureConversationAssigneeForFollowUp,
  jsonGateError,
  resolveEmployeeForOmnichannelSend,
} from "../_shared/omnichannelAssigneeGate.ts";
import {
  buildMetaFlowMessageParameters,
  fetchMetaFlowSendMeta,
  formatMetaGraphError,
  SYNCKERJA_CUSTOM_FORM_SCREEN,
} from "../_shared/omnichannelFlow/metaFlowSendParameters.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const META_API_BASE = "https://graph.facebook.com/v18.0";
const META_CS_WINDOW_MS = 24 * 60 * 60 * 1000;

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

function isWithinMetaCustomerCareWindow(lastInboundAt: string | null | undefined): boolean {
  if (!lastInboundAt?.trim()) return false;
  const ms = new Date(lastInboundAt).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms < META_CS_WINDOW_MS;
}

function isMetaSessionExpired(
  metaSessionExpiresAt: string | null | undefined,
  lastInboundAt?: string | null,
): boolean {
  if (isWithinMetaCustomerCareWindow(lastInboundAt)) return false;
  if (!metaSessionExpiresAt?.trim()) return false;
  const ms = new Date(metaSessionExpiresAt).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() > ms;
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const conversationId = String(body.conversation_id ?? "").trim();
    const flowId = String(body.flow_id ?? "").trim();
    const navigateScreen = String(body.navigate_screen ?? SYNCKERJA_CUSTOM_FORM_SCREEN).trim();
    const flowCta = String(body.flow_cta ?? "View flow").trim().slice(0, 20);
    const bodyText = String(body.body_text ?? "Silakan isi form berikut.").trim().slice(0, 1024);

    if (!conversationId || !flowId) {
      return new Response(JSON.stringify({ error: "conversation_id and flow_id required", code: "INVALID_BODY" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const orgId = profile?.active_organization_id != null ? String(profile.active_organization_id) : "";
    if (!orgId) {
      return new Response(JSON.stringify({ error: "No active organization", code: "NO_ORG" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderResult = await resolveEmployeeForOmnichannelSend(admin, userData.user.id, orgId);
    if (!senderResult.ok) {
      return new Response(JSON.stringify({ error: senderResult.error, code: senderResult.code }), {
        status: senderResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conv } = await admin
      .from("whatsapp_conversations")
      .select(
        "id, organization_id, customer_wa_id, customer_name, phone_number_id, assignee_id, meta_session_expires_at, last_inbound_at",
      )
      .eq("id", conversationId)
      .maybeSingle();

    if (!conv || String(conv.organization_id) !== orgId) {
      return new Response(JSON.stringify({ error: "Conversation not found", code: "CONVERSATION_NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let effectiveAssigneeId = conv.assignee_id as string | null;
    let assigneeAutoAssigned = false;

    const assigneeEnsure = await ensureConversationAssigneeForFollowUp(
      admin,
      conversationId,
      effectiveAssigneeId,
      senderResult.employeeId,
    );
    effectiveAssigneeId = assigneeEnsure.effectiveAssigneeId;
    assigneeAutoAssigned = assigneeEnsure.autoAssigned;

    const assigneeMismatch = assertSenderIsActiveAssignee(
      effectiveAssigneeId,
      senderResult.employeeId,
    );
    if (assigneeMismatch) return jsonGateError(assigneeMismatch, corsHeaders);

    if (
      isMetaSessionExpired(
        conv.meta_session_expires_at as string | null,
        conv.last_inbound_at as string | null,
      )
    ) {
      return new Response(
        JSON.stringify({
          error: "Jendela 24 jam sudah berakhir. Gunakan template Flow untuk follow-up.",
          code: "SESSION_EXPIRED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phoneNumberId = String(conv.phone_number_id ?? "").trim();
    const { data: waAccount } = await admin
      .from("organization_whatsapp_accounts")
      .select("id, meta_access_token, phone_number_id")
      .eq("organization_id", orgId)
      .eq("phone_number_id", phoneNumberId)
      .eq("is_active", true)
      .maybeSingle();

    const accessToken = String(waAccount?.meta_access_token ?? "").trim();
    if (!accessToken || !phoneNumberId) {
      return new Response(JSON.stringify({ error: "WhatsApp not configured", code: "WHATSAPP_NOT_CONFIGURED" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toDigits = digitsOnly(String(conv.customer_wa_id ?? ""));
    if (!toDigits) {
      return new Response(JSON.stringify({ error: "Missing customer number", code: "MISSING_TO" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const flowToken = crypto.randomUUID();

    const flowMeta = await fetchMetaFlowSendMeta(flowId, accessToken);
    if (!flowMeta.status) {
      return new Response(
        JSON.stringify({
          error: "Flow tidak ditemukan di Meta atau ID tidak valid.",
          code: "FLOW_NOT_FOUND",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const flowParameters = buildMetaFlowMessageParameters({
      flowId,
      flowToken,
      flowCta,
      flowMeta,
      navigateScreen,
    });

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toDigits,
      type: "interactive",
      interactive: {
        type: "flow",
        body: { text: bodyText },
        action: {
          name: "flow",
          parameters: flowParameters,
        },
      },
    };

    const graphUrl = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`;
    const graphRes = await fetch(graphUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const graphJson = await graphRes.json().catch(() => ({}));
    if (!graphRes.ok) {
      const msg = formatMetaGraphError(graphJson);
      const hint =
        flowMeta.status === "DRAFT"
          ? " Flow masih DRAFT — publish dulu di Form Flows, atau kirim ulang setelah publish."
          : "";
      return new Response(JSON.stringify({ error: `${msg}${hint}`, code: "META_SEND_FAILED" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const waMessageId = String(
      (graphJson as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id ?? "",
    ).trim();
    const now = new Date().toISOString();

    const insertPayload = {
      conversation_id: conversationId,
      direction: "outbound",
      wa_message_id: waMessageId || null,
      platform_message_id: waMessageId || null,
      channel: "whatsapp",
      body: `${bodyText}\n\n[View flow · ${flowCta}]`,
      message_type: "interactive",
      raw_metadata: { ...payload, flow_interactive: payload.interactive },
      created_at: now,
    };

    const { data: insertedMsg, error: insErr } = await admin
      .from("whatsapp_messages")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insErr) {
      console.error("send-whatsapp-flow-session insert error:", insErr);
    }

    await admin
      .from("whatsapp_conversations")
      .update({
        last_message_at: now,
        last_message_body: insertPayload.body.slice(0, 200),
        updated_at: now,
      })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: conversationId,
        message: insertedMsg ?? null,
        assignee_id: effectiveAssigneeId ?? undefined,
        assignee_auto_assigned: assigneeAutoAssigned,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-whatsapp-flow-session error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
