/** CTWA conversation → CRM lead sync helpers. */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mergeAttributionWithCtwa,
  mergeCtwaClid,
  parseCtwaReferral,
  type CtwaReferralSnapshot,
} from "./ctwaReferral.ts";

export const WA_TICKET_PREFIX = "WA-";

export function waTicketPrefixFromConvId(convId: string): string {
  return String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function waTicketIdFromConvId(convId: string): string {
  return WA_TICKET_PREFIX + waTicketPrefixFromConvId(convId);
}

export function waTicketPrefixFromTicketId(ticketId: string | null | undefined): string | null {
  const t = String(ticketId ?? "").trim().toUpperCase();
  if (!t.startsWith(WA_TICKET_PREFIX)) return null;
  const prefix = t.slice(WA_TICKET_PREFIX.length);
  return prefix.length === 8 ? prefix : null;
}

export function buildLeadCtwaUpdate(
  existingAttribution: unknown,
  snapshot: CtwaReferralSnapshot,
  capturedAtIso: string,
): { ctwa_clid: string; attribution: Record<string, unknown> } {
  return {
    ctwa_clid: snapshot.ctwa_clid,
    attribution: mergeAttributionWithCtwa(existingAttribution, snapshot, capturedAtIso),
  };
}

function snapshotFromConversationRow(row: {
  ctwa_clid: string;
  ctwa_referral: unknown;
}): CtwaReferralSnapshot | null {
  const clid = String(row.ctwa_clid ?? "").trim();
  if (!clid) return null;
  const fromReferral = parseCtwaReferral(row.ctwa_referral);
  if (fromReferral) return fromReferral;
  const raw =
    row.ctwa_referral != null && typeof row.ctwa_referral === "object"
      ? (row.ctwa_referral as Record<string, unknown>)
      : { ctwa_clid: clid };
  return {
    ctwa_clid: clid,
    source_type: null,
    source_id: null,
    source_url: null,
    headline: null,
    body: null,
    raw,
  };
}

type ConvCtwaRow = {
  id: string;
  ctwa_clid: string | null;
  ctwa_referral: unknown;
  ctwa_captured_at: string | null;
};

/** Idempotent first-touch sync from conversation CTWA columns to linked lead (by WA ticket). */
export async function syncCtwaClidToLinkedLead(
  supabase: SupabaseClient,
  args: { organizationId: string; conversationId: string },
): Promise<boolean> {
  const { organizationId, conversationId } = args;

  const { data: convRow, error: convErr } = await supabase
    .from("whatsapp_conversations")
    .select("id, ctwa_clid, ctwa_referral, ctwa_captured_at")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (convErr || !convRow?.ctwa_clid?.trim()) return false;

  const snapshot = snapshotFromConversationRow(convRow as ConvCtwaRow);
  if (!snapshot) return false;

  const capturedAt = convRow.ctwa_captured_at?.trim() || new Date().toISOString();
  const ticketId = waTicketIdFromConvId(conversationId);

  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select("id, attribution, ctwa_clid")
    .eq("organization_id", organizationId)
    .eq("ticket_id", ticketId)
    .maybeSingle();

  if (leadErr || !leadRow?.id) return false;
  if (leadRow.ctwa_clid?.trim()) return false;

  const patch = buildLeadCtwaUpdate(leadRow.attribution, snapshot, capturedAt);
  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("leads")
    .update({
      ctwa_clid: patch.ctwa_clid,
      attribution: patch.attribution,
      updated_at: now,
    })
    .eq("id", leadRow.id)
    .eq("organization_id", organizationId)
    .is("ctwa_clid", null);

  if (updateErr) {
    console.error("syncCtwaClidToLinkedLead: lead update failed", updateErr.message);
    return false;
  }
  return true;
}

async function findConversationByWaTicketPrefix(
  supabase: SupabaseClient,
  organizationId: string,
  prefix: string,
): Promise<ConvCtwaRow | null> {
  const { data: rows, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, ctwa_clid, ctwa_referral, ctwa_captured_at")
    .eq("organization_id", organizationId)
    .ilike("id", `${prefix.toLowerCase()}%`)
    .not("ctwa_clid", "is", null)
    .limit(2);

  if (error) {
    console.error("findConversationByWaTicketPrefix:", error.message);
    return null;
  }
  const list = (rows ?? []) as ConvCtwaRow[];
  if (list.length === 0) return null;
  if (list.length > 1) {
    console.warn("findConversationByWaTicketPrefix: multiple conversations for prefix", prefix);
  }
  return list[0];
}

/** Resolve CTWA click id from lead columns, attribution, or linked WA conversation (with self-heal sync). */
export async function resolveCtwaClidForLead(
  supabase: SupabaseClient,
  args: {
    organizationId: string;
    ticketId: string | null | undefined;
    leadCtwaClid: string | null | undefined;
    attribution: unknown;
    /** When known (e.g. from webhook), skip prefix lookup. */
    conversationId?: string | null;
  },
): Promise<string | null> {
  const fromLead = mergeCtwaClid(
    args.leadCtwaClid != null ? String(args.leadCtwaClid) : null,
    args.attribution,
  );
  if (fromLead) return fromLead;

  let conversationId = args.conversationId?.trim() || null;
  if (!conversationId) {
    const prefix = waTicketPrefixFromTicketId(args.ticketId);
    if (!prefix) return null;
    const conv = await findConversationByWaTicketPrefix(supabase, args.organizationId, prefix);
    if (!conv?.ctwa_clid?.trim()) return null;
    conversationId = conv.id;
  }

  await syncCtwaClidToLinkedLead(supabase, {
    organizationId: args.organizationId,
    conversationId,
  });

  const { data: refreshed } = await supabase
    .from("leads")
    .select("ctwa_clid, attribution")
    .eq("organization_id", args.organizationId)
    .eq("ticket_id", waTicketIdFromConvId(conversationId))
    .maybeSingle();

  return mergeCtwaClid(
    refreshed?.ctwa_clid != null ? String(refreshed.ctwa_clid) : null,
    refreshed?.attribution,
  );
}
