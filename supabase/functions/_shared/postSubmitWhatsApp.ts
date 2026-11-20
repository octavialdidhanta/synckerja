import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  extractWaMessageIdFromRawText,
  formatTemplateMessageBody,
  normalizePhoneE164,
  parseTemplateBodyKeysFromResolved,
  resolveWhatsappPhoneNumberIdFromOrgTable,
  resolveWhatsappTemplateEnvWithDb,
  sendWhatsappTemplateToClient,
  syncLeadTicketAfterOutboundConversation,
  upsertConversationAndInsertOutboundMessage,
  type WhatsappSendResult,
} from "./whatsappHub.ts";

export type PostSubmitWhatsAppResponse = {
  sent: boolean;
  skipped?: boolean;
  skip_reason?: string;
  message_id?: string | null;
  error?: string;
};

function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

/** Build Meta template ctx for vialdi-wedding contact-main (parity wedding-package-lead). */
export function buildWeddingWhatsAppCtx(args: {
  submissionId: string;
  leadId: string;
  name: string;
  email: string;
  phone_number: string;
  package_label: string;
  mergedFormData: Record<string, unknown>;
}): Record<string, string> {
  const pkg = args.package_label.trim();
  const evDate =
    typeof args.mergedFormData.event_date === "string" && isIsoDateOnly(args.mergedFormData.event_date)
      ? args.mergedFormData.event_date.trim()
      : "";
  const evTime = String(args.mergedFormData.event_time ?? "").trim();
  const evAddr = String(args.mergedFormData.event_address ?? "").trim();
  const jobLine = [evDate && `Tanggal ${evDate}`, evTime && `Jam ${evTime}`].filter(Boolean).join(" · ");

  return {
    name: args.name,
    email: args.email,
    phone_number: args.phone_number,
    industry: pkg || "Wedding",
    business_type: "B2C",
    job_title: jobLine || "Calon pengantin",
    needs: pkg || "Konsultasi paket wedding",
    office_address: evAddr || "\u2014",
    lead_id: args.leadId,
    lead_vialdiid_id: args.submissionId,
    package_label: pkg,
    event_date: evDate,
    event_time: evTime,
    event_address: evAddr,
    submission_id: args.submissionId,
    leads_vialdi_wedding_id: args.submissionId,
    ringkasan_kebutuhan: String(args.mergedFormData.ringkasan_kebutuhan ?? "").trim(),
  };
}

function waResponseFromSend(wa: WhatsappSendResult): PostSubmitWhatsAppResponse {
  if (!wa.ok) {
    return { sent: false, error: wa.error, skipped: wa.skipped, skip_reason: wa.skip_reason };
  }
  if (wa.skipped) {
    return { sent: false, skipped: true, skip_reason: wa.skip_reason, message_id: null };
  }
  return { sent: true, message_id: wa.message_id ?? null };
}

/** Send WhatsApp template after hub final submit (vialdi-wedding contact-main). */
export async function runPostSubmitWhatsAppForSubmission(args: {
  admin: SupabaseClient;
  organizationId: string;
  webId: string;
  formId: string;
  submissionId: string;
  leadId: string;
  name: string;
  email: string;
  phone_number: string;
  package_label: string | null;
  mergedFormData: Record<string, unknown>;
}): Promise<PostSubmitWhatsAppResponse | null> {
  if (args.webId !== "vialdi-wedding" || args.formId !== "contact-main") {
    return null;
  }

  const pkg = (args.package_label ?? "").trim();
  const to = normalizePhoneE164(args.phone_number);
  if (!to) {
    return { sent: false, error: "Invalid phone for WhatsApp (empty after normalization)" };
  }

  const ctx = buildWeddingWhatsAppCtx({
    submissionId: args.submissionId,
    leadId: args.leadId,
    name: args.name,
    email: args.email,
    phone_number: args.phone_number,
    package_label: pkg,
    mergedFormData: args.mergedFormData,
  });

  const graphPhoneNumberId = await resolveWhatsappPhoneNumberIdFromOrgTable(
    args.admin,
    args.organizationId,
    args.webId,
  );

  const wa = await sendWhatsappTemplateToClient({
    toE164: to,
    ctx,
    graphPhoneNumberId,
    webId: args.webId,
    admin: args.admin,
    organizationId: args.organizationId,
  });

  if (wa.ok && wa.skipped && wa.skip_reason) {
    console.warn(`contact-submit: lead ${args.leadId} saved; WhatsApp skipped: ${wa.skip_reason}`);
  }
  if (!wa.ok) {
    console.error(`contact-submit: WhatsApp API error for lead ${args.leadId}:`, wa.error);
  }

  const waTemplateResolved = await resolveWhatsappTemplateEnvWithDb(
    args.admin,
    args.organizationId,
    args.webId,
  );
  const templateName = waTemplateResolved.templateName;
  const templateLanguage = waTemplateResolved.templateLanguage;
  const phoneNumberId = (graphPhoneNumberId?.trim() || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "").trim();

  if (wa.ok && !wa.skipped && phoneNumberId) {
    const keys = parseTemplateBodyKeysFromResolved(waTemplateResolved);
    const messagePreview = formatTemplateMessageBody({ templateName, keys, ctx });
    const lastMessageBody = messagePreview.slice(0, 1024);
    const responseText = wa.ok && "response_text" in wa ? (wa.response_text ?? "") : "";
    const effectiveWamid = (
      (typeof wa.message_id === "string" && wa.message_id.trim()) ||
      extractWaMessageIdFromRawText(responseText) ||
      ""
    ).trim();

    const rawMetadata: Record<string, unknown> = {
      source: "contact-submit",
      template: { name: templateName, language: templateLanguage },
      template_body_keys: keys,
      lead_id: args.leadId,
      submission_id: args.submissionId,
      customer_e164: to,
      graph_wamid: effectiveWamid || null,
      parameters: Object.fromEntries(keys.map((k) => [k, ctx[k] ?? ""])),
      graph_response_snippet: responseText.slice(0, 2000),
    };

    const whatsapp_db = await upsertConversationAndInsertOutboundMessage({
      admin: args.admin,
      organizationId: args.organizationId,
      customerE164: to,
      customerName: args.name,
      phoneNumberId,
      waMessageId: effectiveWamid,
      messageBody: messagePreview,
      idempotencyKey: `contact-submit:step2:${args.submissionId}`,
      lastMessageBody,
      rawMetadata,
    });

    if ("error" in whatsapp_db) {
      console.warn("contact-submit: whatsapp_messages upsert failed", whatsapp_db.error);
    } else {
      await syncLeadTicketAfterOutboundConversation(
        args.admin,
        args.organizationId,
        args.leadId,
        whatsapp_db,
        to.replace(/^\+/, "").replace(/[^\d]/g, ""),
      );
    }
  }

  return waResponseFromSend(wa);
}
