import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Channel / stub labels that must not become Google Contact or CRM display names. */
const PLACEHOLDER_CLIENT_NAMES = new Set(
  [
    "whatsapp floating click",
    "website visitor",
    "whatsapp button",
    "whatsapp",
    "instagram contact",
    "instagram",
    "messenger contact",
    "messenger",
    "facebook contact",
    "facebook",
    "lead",
    "floating wa click",
  ].map((s) => s.toLowerCase()),
);

export function isPlaceholderLeadClientName(name: string | null | undefined): boolean {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return true;
  return PLACEHOLDER_CLIENT_NAMES.has(trimmed.toLowerCase());
}

function ticketChannel(ticketId: string | null | undefined): "WA" | "IG" | "FB" | null {
  const raw = String(ticketId ?? "").trim().toUpperCase();
  if (raw.startsWith("WA-")) return "WA";
  if (raw.startsWith("IG-")) return "IG";
  if (raw.startsWith("FB-")) return "FB";
  return null;
}

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Resolve WhatsApp / Instagram / Messenger profile name linked to a lead ticket or phone. */
export async function resolveChannelCustomerName(
  admin: SupabaseClient,
  organizationId: string,
  ticketId: string | null | undefined,
  phone: string | null | undefined,
): Promise<string | null> {
  const tid = String(ticketId ?? "").trim();
  const channel = ticketChannel(tid);

  if (channel === "WA" && tid) {
    const { data } = await admin
      .from("whatsapp_conversations")
      .select("customer_name")
      .eq("organization_id", organizationId)
      .eq("ticket_id", tid)
      .maybeSingle();
    const name = String(data?.customer_name ?? "").trim();
    if (name && !isPlaceholderLeadClientName(name)) return name;
  }

  if (channel === "IG" && tid) {
    const { data } = await admin
      .from("instagram_conversations")
      .select("customer_name")
      .eq("organization_id", organizationId)
      .eq("ticket_id", tid)
      .maybeSingle();
    const name = String(data?.customer_name ?? "").trim();
    if (name && !isPlaceholderLeadClientName(name)) return name;

    // Older rows may lack ticket_id on conversation — match by id prefix from IG-XXXXXXXX
    const hex = tid.slice(3).toLowerCase();
    if (/^[a-f0-9]{8}$/.test(hex)) {
      const { data: rows } = await admin
        .from("instagram_conversations")
        .select("customer_name")
        .eq("organization_id", organizationId)
        .like("id", `${hex}%`)
        .limit(1);
      const n = String(rows?.[0]?.customer_name ?? "").trim();
      if (n && !isPlaceholderLeadClientName(n)) return n;
    }
  }

  if (channel === "FB" && tid) {
    const { data } = await admin
      .from("facebook_conversations")
      .select("customer_name")
      .eq("organization_id", organizationId)
      .eq("ticket_id", tid)
      .maybeSingle();
    const name = String(data?.customer_name ?? "").trim();
    if (name && !isPlaceholderLeadClientName(name)) return name;
  }

  const phoneDigits = digitsOnly(phone);
  if (phoneDigits.length >= 8) {
    const { data } = await admin
      .from("whatsapp_conversations")
      .select("customer_name")
      .eq("organization_id", organizationId)
      .eq("customer_wa_id", phoneDigits)
      .limit(1)
      .maybeSingle();
    const name = String(data?.customer_name ?? "").trim();
    if (name && !isPlaceholderLeadClientName(name)) return name;
  }

  return null;
}

/**
 * Pick a human contact display name for CRM / Google Contacts.
 * Prefer real submission/lead names; skip channel placeholders; fall back to channel profile, then phone.
 */
export function pickLeadContactDisplayName(input: {
  submissionName?: string | null;
  leadClient?: string | null;
  channelCustomerName?: string | null;
  phone?: string | null;
}): { name: string; shouldPatchLeadClient: boolean } {
  const submission = String(input.submissionName ?? "").trim();
  const leadClient = String(input.leadClient ?? "").trim();
  const channelName = String(input.channelCustomerName ?? "").trim();
  const phone = String(input.phone ?? "").trim();

  if (submission && !isPlaceholderLeadClientName(submission)) {
    return {
      name: submission,
      shouldPatchLeadClient: isPlaceholderLeadClientName(leadClient) && leadClient !== submission,
    };
  }
  if (leadClient && !isPlaceholderLeadClientName(leadClient)) {
    return { name: leadClient, shouldPatchLeadClient: false };
  }
  if (channelName && !isPlaceholderLeadClientName(channelName)) {
    return { name: channelName, shouldPatchLeadClient: true };
  }
  if (phone) {
    return { name: phone, shouldPatchLeadClient: isPlaceholderLeadClientName(leadClient) };
  }
  return { name: "Lead", shouldPatchLeadClient: false };
}

/** If lead.client is a placeholder and we have a real channel name, update it. */
export async function refreshLeadClientIfPlaceholder(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    leadId?: string | null;
    ticketId?: string | null;
    clientName: string | null | undefined;
  },
): Promise<void> {
  const next = String(args.clientName ?? "").trim();
  if (!next || isPlaceholderLeadClientName(next)) return;

  let leadId = args.leadId ? String(args.leadId) : "";
  if (!leadId && args.ticketId) {
    const { data } = await admin
      .from("leads")
      .select("id, client")
      .eq("organization_id", args.organizationId)
      .eq("ticket_id", args.ticketId)
      .maybeSingle();
    if (!data?.id) return;
    if (!isPlaceholderLeadClientName(data.client as string | null)) return;
    leadId = String(data.id);
  } else if (leadId) {
    const { data } = await admin
      .from("leads")
      .select("client")
      .eq("id", leadId)
      .eq("organization_id", args.organizationId)
      .maybeSingle();
    if (!data || !isPlaceholderLeadClientName(data.client as string | null)) return;
  } else {
    return;
  }

  await admin
    .from("leads")
    .update({ client: next, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("organization_id", args.organizationId);
}
