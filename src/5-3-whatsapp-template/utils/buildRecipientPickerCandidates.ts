import { normalizeWaPhoneKey, pickDisplayPhone } from "./normalizeWaPhoneKey";

export type PickerCandidateOrigin = "lead" | "livechat";

export type RecipientPickerCandidate = {
  phoneKey: string;
  displayPhone: string;
  displayName: string;
  lead_id: string | null;
  conversation_id: string | null;
  lead_source: string | null;
  origin: PickerCandidateOrigin;
  priority: number;
};

type LeadRow = {
  id: string;
  ticket_id: string | null;
  client: string | null;
  source: string | null;
  phone_number: string | null;
  organization_id: string;
};

type LeadProfileRow = {
  lead_id: string;
  phone_number: string | null;
  updated_at: string | null;
};

type WaConvRow = {
  id: string;
  ticket_id: string | null;
  organization_id: string;
  customer_wa_id: string | null;
  customer_name: string | null;
  channel: string | null;
};

type WaClientProfileRow = {
  conversation_id: string;
  phone_number: string | null;
};

function firstNonEmptyPhone(
  parts: Array<string | null | undefined>,
): { raw: string; key: string } | null {
  for (const p of parts) {
    const raw = p == null ? "" : String(p).trim();
    if (!raw) continue;
    const key = normalizeWaPhoneKey(raw);
    if (key) return { raw, key };
  }
  return null;
}

function pickLatestProfile(profiles: LeadProfileRow[], leadId: string): LeadProfileRow | null {
  const list = profiles.filter((x) => x.lead_id === leadId);
  if (list.length === 0) return null;
  list.sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
  return list[0] ?? null;
}

export function buildRecipientPickerCandidates(args: {
  leads: LeadRow[];
  leadProfiles: LeadProfileRow[];
  conversations: WaConvRow[];
  waClientProfiles: WaClientProfileRow[];
}): RecipientPickerCandidate[] {
  const { leads, leadProfiles, conversations, waClientProfiles } = args;

  const convByTicket = new Map<string, WaConvRow>();
  for (const c of conversations) {
    const ch = (c.channel ?? "whatsapp").toLowerCase();
    if (ch === "instagram") continue;
    const tid = String(c.ticket_id ?? "").trim();
    if (tid) convByTicket.set(tid, c);
  }

  const waProfByConv = new Map<string, WaClientProfileRow>();
  for (const p of waClientProfiles) {
    waProfByConv.set(p.conversation_id, p);
  }

  const rows: RecipientPickerCandidate[] = [];
  const leadTicketsWithCandidate = new Set<string>();

  for (const lead of leads) {
    const lcp = pickLatestProfile(leadProfiles, lead.id);
    const ticket = String(lead.ticket_id ?? "").trim();
    const wc = ticket ? convByTicket.get(ticket) ?? null : null;
    const waProf = wc ? waProfByConv.get(wc.id) ?? null : null;

    const resolved = firstNonEmptyPhone([
      lcp?.phone_number,
      lead.phone_number,
      waProf?.phone_number,
      wc?.customer_wa_id,
    ]);

    if (ticket) leadTicketsWithCandidate.add(ticket);

    const displayName =
      String(lead.client ?? "").trim() ||
      (resolved ? pickDisplayPhone(wc?.customer_name, resolved.key) : String(lead.ticket_id ?? lead.id));
    const priority = 100_000 + (wc ? 500 : 0);
    rows.push({
      phoneKey: resolved?.key ?? "",
      displayPhone: resolved ? pickDisplayPhone(resolved.raw, resolved.key) : "",
      displayName,
      lead_id: lead.id,
      conversation_id: wc?.id ?? null,
      lead_source: lead.source ?? null,
      origin: "lead",
      priority,
    });
  }

  for (const wc of conversations) {
    const ch = (wc.channel ?? "whatsapp").toLowerCase();
    if (ch === "instagram") continue;
    const tid = String(wc.ticket_id ?? "").trim();
    if (tid && leadTicketsWithCandidate.has(tid)) continue;

    const resolved = firstNonEmptyPhone([waProfByConv.get(wc.id)?.phone_number, wc.customer_wa_id]);
    if (!resolved) continue;

    const displayName = String(wc.customer_name ?? "").trim() || resolved.key;
    rows.push({
      phoneKey: resolved.key,
      displayPhone: pickDisplayPhone(resolved.raw, resolved.key),
      displayName,
      lead_id: null,
      conversation_id: wc.id,
      lead_source: "WhatsApp",
      origin: "livechat",
      priority: 50_000,
    });
  }

  rows.sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  const deduped: RecipientPickerCandidate[] = [];
  for (const r of rows) {
    const rowKey =
      r.lead_id != null
        ? `lead:${r.lead_id}`
        : r.conversation_id != null
          ? `lc:${r.conversation_id}`
          : `phone:${r.phoneKey}`;
    if (seen.has(rowKey)) continue;
    seen.add(rowKey);
    deduped.push(r);
  }

  deduped.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
  return deduped;
}

export const RECIPIENT_PICKER_MAX_SELECT = 50_000;
