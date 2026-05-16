import type { NewLead } from "@/shared/types/leads";

/** True when lead row represents a WhatsApp omnichannel contact (not IG/email). */
export function isWhatsappLeadForSurvey(lead: NewLead): boolean {
  const ch = (lead.channel ?? "").trim().toLowerCase();
  if (ch === "instagram" || ch === "email") return false;
  if (String(lead.id).startsWith("wa-")) return true;
  if (ch === "whatsapp") return true;
  const src = (lead.source ?? "").trim().toLowerCase();
  if (src === "whatsapp") return true;
  const tid = (lead.ticket_id ?? "").trim().toUpperCase();
  return tid.startsWith("WA-");
}

/** Conversation UUID when known from virtual wa-* id only (sync path uses ticket lookup). */
export function resolveWhatsappConversationIdFromLeadId(lead: NewLead): string | null {
  if (!isWhatsappLeadForSurvey(lead)) return null;
  const id = String(lead.id ?? "");
  if (id.startsWith("wa-")) return id.slice(3);
  return null;
}

export function collectTicketIdsForWaLookup(leads: NewLead[]): string[] {
  const tickets = new Set<string>();
  for (const lead of leads) {
    if (!isWhatsappLeadForSurvey(lead)) continue;
    if (String(lead.id).startsWith("wa-")) continue;
    const tid = (lead.ticket_id ?? "").trim();
    if (tid && tid.toUpperCase().startsWith("WA-")) tickets.add(tid);
  }
  return [...tickets];
}
