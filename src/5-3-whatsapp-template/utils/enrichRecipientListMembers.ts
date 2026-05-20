import { normalizeWaPhoneKey, pickDisplayPhone } from "./normalizeWaPhoneKey";

export type LeadRowLite = { id: string; client: string | null; phone_number: string | null };
export type LeadProfileLite = {
  lead_id: string;
  phone_number: string | null;
  updated_at: string | null;
};
export type WaConvLite = { id: string; customer_name: string | null; customer_wa_id: string | null };

export type MemberRowLite = {
  id: string;
  phone_normalized: string;
  lead_id: string | null;
  conversation_id: string | null;
  origin?: string | null;
  import_full_name?: string | null;
  import_customer_name?: string | null;
  import_company?: string | null;
};

export type RecipientListMemberViewRow = {
  id: string;
  phoneDisplay: string;
  fullName: string;
};

function pickLatestProfile(profiles: LeadProfileLite[], leadId: string): LeadProfileLite | null {
  const list = profiles.filter((p) => p.lead_id === leadId);
  if (list.length === 0) return null;
  list.sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
  return list[0] ?? null;
}

export function enrichRecipientListMembers(
  members: MemberRowLite[],
  leads: LeadRowLite[],
  profiles: LeadProfileLite[],
  conversations: WaConvLite[],
): RecipientListMemberViewRow[] {
  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const convMap = new Map(conversations.map((c) => [c.id, c]));

  return members.map((m) => {
    const lead = m.lead_id ? leadMap.get(m.lead_id) ?? null : null;
    const conv = m.conversation_id ? convMap.get(m.conversation_id) ?? null : null;
    const lcp = m.lead_id ? pickLatestProfile(profiles, m.lead_id) : null;

    const parts = [lcp?.phone_number, lead?.phone_number, conv?.customer_wa_id];
    let raw = "";
    for (const p of parts) {
      const t = String(p ?? "").trim();
      if (!t) continue;
      if (normalizeWaPhoneKey(t)) {
        raw = t;
        break;
      }
    }
    if (!raw) raw = m.phone_normalized;

    const phoneDisplay = pickDisplayPhone(raw, m.phone_normalized);
    const isFile = String(m.origin ?? "").toLowerCase() === "file";
    const fileFull = String(m.import_full_name ?? "").trim();
    const fileCustomer = String(m.import_customer_name ?? "").trim();

    const fullName = isFile
      ? fileFull || fileCustomer || phoneDisplay
      : String(lead?.client ?? "").trim() ||
        String(conv?.customer_name ?? "").trim() ||
        phoneDisplay;

    return { id: m.id, phoneDisplay, fullName };
  });
}
