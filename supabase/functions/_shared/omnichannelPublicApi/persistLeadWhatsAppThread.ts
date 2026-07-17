import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildWaTicketId,
  digitsOnly,
  resolveLeadStatusIdByName,
} from "./whatsappConversationForLead.ts";

export type PersistLeadWhatsAppThreadArgs = {
  organizationId: string;
  leadId: string;
  webId: string;
  phoneNumber: string;
  customerName: string;
  waMessageId: string;
  templateName: string;
  templateLanguage: string;
  bodyPreview: string;
  bodyParams?: string[];
  rawMetadata?: Record<string, unknown> | null;
  whatsappAccountId: string;
  phoneNumberId: string;
  /** When set, tags outbound as Lead Magnet (webhook fallback + debugging). */
  leadMagnetMeta?: {
    enrollmentId: string;
    campaignId: string;
  };
};

export type PersistLeadWhatsAppThreadResult =
  | { ok: true; conversationId: string; ticketId: string; messageRowId: string | null }
  | { ok: false; error: string };

function parseWabaExpirationUnixSeconds(meta: Record<string, unknown> | null | undefined): number | null {
  if (!meta) return null;
  const messages = meta.messages as unknown[] | undefined;
  const first = messages?.[0] as Record<string, unknown> | undefined;
  const conv = first?.conversation as { expiration_timestamp?: string | number } | undefined;
  const raw = conv?.expiration_timestamp;
  if (raw == null) return null;
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function insertWhatsAppMessageCompat(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<{ id: string | null; error: string | null }> {
  const compatibilityPayload: Record<string, unknown> = { ...payload };
  const dropColumnsInOrder = ["status", "platform_message_id", "channel"] as const;

  for (const col of [null, ...dropColumnsInOrder]) {
    if (col) delete compatibilityPayload[col];
    const attempt = await admin
      .from("whatsapp_messages")
      .insert(compatibilityPayload)
      .select("id")
      .single();
    if (!attempt.error) {
      const id = attempt.data?.id != null ? String(attempt.data.id) : null;
      return { id, error: null };
    }
    const code = (attempt.error as { code?: string }).code;
    if (code !== "PGRST204") {
      return { id: null, error: attempt.error.message ?? "insert failed" };
    }
  }
  return { id: null, error: "whatsapp_messages insert failed" };
}

/** Persist outbound lead API template as livechat thread + merge LEAD ticket to WA ticket. */
export async function persistLeadWhatsAppThread(
  admin: SupabaseClient,
  args: PersistLeadWhatsAppThreadArgs,
): Promise<PersistLeadWhatsAppThreadResult> {
  try {
    const phoneDigits = digitsOnly(args.phoneNumber);
    if (phoneDigits.length < 8) {
      return { ok: false, error: "Nomor telepon tidak valid untuk conversation." };
    }

    const { data: lead } = await admin
      .from("leads")
      .select("id, client, title, ticket_id, assignee_id")
      .eq("id", args.leadId)
      .eq("organization_id", args.organizationId)
      .maybeSingle();
    if (!lead) return { ok: false, error: "Lead not found." };

    const pnId = String(args.phoneNumberId).trim();
    const customerName = String(args.customerName ?? lead.client ?? lead.title ?? "").trim() || phoneDigits;
    const now = new Date().toISOString();
    const unreadStatusId = await resolveLeadStatusIdByName(admin, args.organizationId, "Unread");

    const { data: existingConv } = await admin
      .from("whatsapp_conversations")
      .select("id, ticket_id")
      .eq("organization_id", args.organizationId)
      .eq("customer_wa_id", phoneDigits)
      .eq("channel", "whatsapp")
      .eq("phone_number_id", pnId)
      .maybeSingle();

    let conversationId: string;

    if (existingConv?.id) {
      conversationId = String(existingConv.id);
    } else {
      const { data: inserted, error: insertErr } = await admin
        .from("whatsapp_conversations")
        .insert({
          organization_id: args.organizationId,
          customer_wa_id: phoneDigits,
          customer_external_id: phoneDigits,
          customer_name: customerName,
          channel: "whatsapp",
          phone_number_id: pnId,
          assignee_id: lead.assignee_id ?? null,
          last_message_at: now,
          last_message_body: "",
          updated_at: now,
          ...(unreadStatusId ? { lead_status_id: unreadStatusId } : {}),
        })
        .select("id")
        .single();

      if (insertErr || !inserted?.id) {
        console.error("persistLeadWhatsAppThread conv insert:", insertErr);
        return { ok: false, error: insertErr?.message ?? "Conversation insert failed." };
      }
      conversationId = String(inserted.id);
    }

    const waTicketId =
      (existingConv?.ticket_id as string | null)?.trim() || buildWaTicketId(conversationId);

    const { data: waTicketLead } = await admin
      .from("leads")
      .select("id")
      .eq("organization_id", args.organizationId)
      .eq("ticket_id", waTicketId)
      .maybeSingle();

    if (waTicketLead?.id && waTicketLead.id !== args.leadId) {
      const { error: delErr } = await admin.from("leads").delete().eq("id", waTicketLead.id);
      if (delErr) {
        console.error("persistLeadWhatsAppThread: delete duplicate WA lead failed", delErr);
      }
    }

    const lastBody = args.bodyPreview.slice(0, 200);
    const convUpdate: Record<string, unknown> = {
      customer_name: customerName,
      last_message_at: now,
      last_message_body: lastBody,
      updated_at: now,
    };
    if (unreadStatusId) convUpdate.lead_status_id = unreadStatusId;
    if (lead.assignee_id) convUpdate.assignee_id = lead.assignee_id;

    const expSec = parseWabaExpirationUnixSeconds(args.rawMetadata ?? null);
    if (expSec != null) {
      convUpdate.meta_session_expires_at = new Date(expSec * 1000).toISOString();
    }

    const { error: convUpErr } = await admin
      .from("whatsapp_conversations")
      .update(convUpdate)
      .eq("id", conversationId);
    if (convUpErr) {
      console.error("persistLeadWhatsAppThread conv update:", convUpErr);
      return { ok: false, error: convUpErr.message };
    }

    const { data: existingMsg } = await admin
      .from("whatsapp_messages")
      .select("id")
      .eq("wa_message_id", args.waMessageId)
      .maybeSingle();

    let messageRowId: string | null = existingMsg?.id ? String(existingMsg.id) : null;

    if (!messageRowId) {
      const insertPayload: Record<string, unknown> = {
        conversation_id: conversationId,
        direction: "outbound",
        wa_message_id: args.waMessageId,
        platform_message_id: args.waMessageId,
        channel: "whatsapp",
        body: args.bodyPreview,
        message_type: "template",
        raw_metadata: {
          ...(args.rawMetadata ?? {}),
          ...(args.leadMagnetMeta
            ? {
                synckerja_lead_magnet: {
                  lead_id: args.leadId,
                  enrollment_id: args.leadMagnetMeta.enrollmentId,
                  campaign_id: args.leadMagnetMeta.campaignId,
                  organization_id: args.organizationId,
                  template_name: args.templateName,
                  template_language: args.templateLanguage,
                  parameter_values: args.bodyParams ?? [],
                  whatsapp_account_id: args.whatsappAccountId,
                },
              }
            : {
                synckerja_lead_api: {
                  lead_id: args.leadId,
                  web_id: args.webId,
                  template_name: args.templateName,
                  template_language: args.templateLanguage,
                  parameter_values: args.bodyParams ?? [],
                  whatsapp_account_id: args.whatsappAccountId,
                },
              }),
        },
        status: "sent",
      };

      const inserted = await insertWhatsAppMessageCompat(admin, insertPayload);
      if (inserted.error && !inserted.id) {
        console.error("persistLeadWhatsAppThread message insert:", inserted.error);
        return { ok: false, error: inserted.error };
      }
      messageRowId = inserted.id;
    }

    const leadUpdate: Record<string, unknown> = {
      ticket_id: waTicketId,
      phone_number: phoneDigits,
      services: "WhatsApp",
      updated_at: now,
    };
    if (unreadStatusId) leadUpdate.status_id = unreadStatusId;

    const { error: leadUpErr } = await admin
      .from("leads")
      .update(leadUpdate)
      .eq("id", args.leadId)
      .eq("organization_id", args.organizationId);
    if (leadUpErr) {
      console.error("persistLeadWhatsAppThread lead ticket merge:", leadUpErr);
    }

    return { ok: true, conversationId, ticketId: waTicketId, messageRowId };
  } catch (e) {
    console.error("persistLeadWhatsAppThread:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown persist error",
    };
  }
}

export function buildLeadTemplateBodyPreview(templateName: string, paramPreview?: string | null): string {
  const name = templateName.trim();
  const extra = paramPreview?.trim();
  if (extra) return `[Template: ${name}] ${extra}`.slice(0, 200);
  return `[Template: ${name}]`.slice(0, 200);
}
