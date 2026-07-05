import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_BASE = "https://graph.facebook.com/v18.0";

export type FlowWhatsAppSendPayload = {
  organization_id?: string;
  conversation_id: string;
  enrollment_id?: string;
  flow_id?: string;
  node_id?: string;
  text?: string;
  to?: string;
  phone_number_id?: string;
  interactive?: Record<string, unknown>;
};

export async function sendFlowWhatsAppMessage(
  admin: SupabaseClient,
  body: FlowWhatsAppSendPayload,
): Promise<{ ok: boolean; error?: string; waMessageId?: string | null }> {
  const organizationId = String(body.organization_id ?? "");
  const conversationId = String(body.conversation_id ?? "");
  const enrollmentId = String(body.enrollment_id ?? "");
  const flowId = String(body.flow_id ?? "");
  const text = String(body.text ?? "").trim();
  const interactive = body.interactive;
  let to = String(body.to ?? "").replace(/\D/g, "");
  const presetPhoneNumberId = String(body.phone_number_id ?? "").trim() || null;

  if (!conversationId || (!text && !interactive)) {
    return { ok: false, error: "conversation_id and text or interactive required" };
  }

  let orgId = organizationId;
  let phoneNumberId = presetPhoneNumberId;

  if (!orgId || !phoneNumberId || !to) {
    const { data: conv } = await admin
      .from("whatsapp_conversations")
      .select("organization_id, phone_number_id, customer_wa_id, channel")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conv) return { ok: false, error: "Conversation not found" };
    if ((conv.channel ?? "whatsapp").toLowerCase() === "instagram") {
      return { ok: false, error: "Instagram not supported" };
    }

    orgId = orgId || (conv.organization_id as string);
    if (!phoneNumberId) phoneNumberId = (conv.phone_number_id as string | null) ?? null;
    if (!to) to = String(conv.customer_wa_id ?? "").replace(/\D/g, "");
  } else if (!orgId) {
    return { ok: false, error: "organization_id required when phone_number_id is preset" };
  }

  const tryAccount = async (oid: string, pnId: string | null) => {
    const base = admin
      .from("organization_whatsapp_accounts")
      .select("meta_access_token, phone_number_id")
      .eq("organization_id", oid)
      .eq("is_active", true);
    const q = pnId ? base.eq("phone_number_id", pnId) : base.limit(1);
    const { data: rows } = await q;
    const data = Array.isArray(rows) ? rows[0] : null;
    if (!data?.phone_number_id) return null;
    let accessToken = String(data.meta_access_token ?? "").trim();
    if (!accessToken) {
      const { data: orgMeta } = await admin
        .from("organization_meta_config")
        .select("meta_access_token")
        .eq("organization_id", oid)
        .maybeSingle();
      accessToken = String(orgMeta?.meta_access_token ?? "").trim();
    }
    if (!accessToken) return null;
    return { meta_access_token: accessToken, phone_number_id: data.phone_number_id };
  };

  const config = await tryAccount(orgId, phoneNumberId);
  if (!config) {
    return { ok: false, error: "WhatsApp account not configured" };
  }

  const metaUrl = `${META_API_BASE}/${config.phone_number_id}/messages`;
  const interactiveType = String(interactive?.type ?? "");
  const isInteractive = interactiveType === "list" || interactiveType === "button";
  const metaBody = isInteractive
    ? {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive,
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      };

  const metaRes = await fetch(metaUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.meta_access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metaBody),
  });

  const metaData = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok) {
    return {
      ok: false,
      error: String(metaData?.error?.message ?? "Meta API error"),
    };
  }

  const waMessageId = metaData.messages?.[0]?.id ?? null;
  const now = new Date().toISOString();

  let storedBody = text;
  let messageType = "text";
  if (isInteractive && interactive) {
    if (interactiveType === "list") {
      const buttonText = String((interactive as { action?: { button?: string } }).action?.button ?? "Pilih Opsi");
      const rows = (interactive as { action?: { sections?: Array<{ rows?: unknown[] }> } }).action?.sections?.[0]?.rows ?? [];
      storedBody = `${text}\n\n[${buttonText} · ${rows.length} option(s)]`;
    } else if (interactiveType === "button") {
      const buttons = (interactive as { action?: { buttons?: Array<{ reply?: { title?: string } }> } }).action?.buttons ?? [];
      const labels = buttons.map((b) => b.reply?.title).filter(Boolean).join(", ");
      storedBody = labels ? `${text}\n\n[${labels}]` : text;
    }
    messageType = "interactive";
  }

  const insertPayload: Record<string, unknown> = {
    conversation_id: conversationId,
    direction: "outbound",
    wa_message_id: waMessageId,
    platform_message_id: waMessageId,
    channel: "whatsapp",
    body: storedBody,
    message_type: messageType,
    raw_metadata: { ...metaData, flow_interactive: interactive ?? null },
    status: "sent",
    source: "flow_automation",
    automation_flow_id: flowId || null,
    automation_enrollment_id: enrollmentId || null,
  };

  void admin.from("whatsapp_messages").insert(insertPayload).then(({ error }) => {
    if (error) console.error("flow send insert error:", error);
  });
  void admin.rpc("sync_conversation_last_message", { p_conversation_id: conversationId });
  void admin
    .from("whatsapp_conversations")
    .update({ last_message_at: now, updated_at: now })
    .eq("id", conversationId);

  return { ok: true, waMessageId };
}
