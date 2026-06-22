import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const WA_TICKET_PREFIX = "WA-";

export function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function buildWaTicketId(conversationId: string): string {
  return `${WA_TICKET_PREFIX}${conversationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function resolveLeadStatusIdByName(
  admin: SupabaseClient,
  organizationId: string,
  name: string,
): Promise<string | null> {
  const { data: orgStatus } = await admin
    .from("lead_statuses")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .maybeSingle();
  if (orgStatus?.id) return String(orgStatus.id);

  const { data: globalStatus } = await admin
    .from("lead_statuses")
    .select("id")
    .is("organization_id", null)
    .eq("name", name)
    .maybeSingle();
  return globalStatus?.id ? String(globalStatus.id) : null;
}

/** Find or create WA conversation for a CRM lead (used by template follow-up). */
export async function findOrCreateConversationForLead(
  admin: SupabaseClient,
  orgId: string,
  leadId: string,
  phoneDigits: string,
  waAccount: { id: string; phone_number_id: string },
): Promise<{ conversationId: string; ticketId: string; created: boolean } | null> {
  const { data: lead } = await admin
    .from("leads")
    .select("id, client, title, ticket_id, assignee_id, organization_id")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!lead) return null;

  const pnId = String(waAccount.phone_number_id).trim();
  const { data: existingConv } = await admin
    .from("whatsapp_conversations")
    .select("id, ticket_id")
    .eq("organization_id", orgId)
    .eq("customer_wa_id", phoneDigits)
    .eq("channel", "whatsapp")
    .eq("phone_number_id", pnId)
    .maybeSingle();

  const now = new Date().toISOString();
  const customerName = String(lead.client ?? lead.title ?? "").trim() || phoneDigits;

  if (existingConv?.id) {
    const convId = String(existingConv.id);
    const ticketId =
      (existingConv.ticket_id as string | null)?.trim() || buildWaTicketId(convId);
    await admin
      .from("whatsapp_conversations")
      .update({
        assignee_id: lead.assignee_id ?? undefined,
        updated_at: now,
      })
      .eq("id", convId);
    const leadTicket = (lead.ticket_id as string | null)?.trim() ?? "";
    if (!leadTicket.startsWith(WA_TICKET_PREFIX)) {
      await admin
        .from("leads")
        .update({ ticket_id: ticketId, phone_number: phoneDigits, updated_at: now })
        .eq("id", leadId);
    }
    return { conversationId: convId, ticketId, created: false };
  }

  const { data: inserted, error: insertErr } = await admin
    .from("whatsapp_conversations")
    .insert({
      organization_id: orgId,
      customer_wa_id: phoneDigits,
      customer_external_id: phoneDigits,
      customer_name: customerName,
      channel: "whatsapp",
      phone_number_id: pnId,
      assignee_id: lead.assignee_id ?? null,
      last_message_at: now,
      last_message_body: "",
      updated_at: now,
    })
    .select("id, ticket_id")
    .single();

  if (insertErr || !inserted?.id) {
    console.error("findOrCreateConversationForLead insert error:", insertErr);
    return null;
  }

  const convId = String(inserted.id);
  const finalTicket =
    (inserted.ticket_id as string | null)?.trim() || buildWaTicketId(convId);
  await admin
    .from("leads")
    .update({ ticket_id: finalTicket, phone_number: phoneDigits, updated_at: now })
    .eq("id", leadId);

  return { conversationId: convId, ticketId: finalTicket, created: true };
}

export async function resolveLeadPhoneDigits(
  admin: SupabaseClient,
  leadId: string,
): Promise<string | null> {
  const { data: lead } = await admin
    .from("leads")
    .select("phone_number")
    .eq("id", leadId)
    .maybeSingle();
  let phone = lead?.phone_number != null ? String(lead.phone_number).trim() : "";
  if (!phone) {
    const { data: submissions } = await admin
      .from("lead_submissions")
      .select("phone_number, status, submitted_at, updated_at")
      .eq("lead_id", leadId)
      .eq("is_active", true)
      .order("status", { ascending: true })
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });
    const rows = submissions ?? [];
    const submitted = rows.find((r) => r.status === "submitted");
    const draft = rows.find((r) => r.status === "draft");
    const picked = submitted ?? draft ?? rows[0];
    phone = picked?.phone_number != null ? String(picked.phone_number).trim() : "";
  }
  const digits = digitsOnly(phone);
  return digits.length >= 8 ? digits : null;
}
