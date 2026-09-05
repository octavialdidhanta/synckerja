import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLineFingerprint } from "@/pos-mobile/2-cashier/lib/cartLineFingerprint";
import { supabase } from "@/shared/lib/supabaseClient";
import { kitchenModifiersTextFromCartLine } from "./buildKitchenTicketLinesFromCart";

export type KitchenNoteSyncPlan = {
  previousFingerprint: string;
  nextFingerprint: string;
  modifiersText: string | null;
  fingerprintChanged: boolean;
};

/**
 * Pure plan for migrating KDS line identity when cashier edits kitchen notes.
 * Returns null for non-product / custom-amount lines.
 */
export function planKitchenTicketLineNoteSync(args: {
  previousFingerprint: string;
  nextLine: CustomerVisitCartLine;
}): KitchenNoteSyncPlan | null {
  const line = args.nextLine;
  if (line.isCustomAmount || line.kind !== "product") return null;
  const nextFingerprint = cartLineFingerprint(line);
  return {
    previousFingerprint: args.previousFingerprint,
    nextFingerprint,
    modifiersText: kitchenModifiersTextFromCartLine(line),
    fingerprintChanged: args.previousFingerprint !== nextFingerprint,
  };
}

/**
 * After notes change on a cart line that was already fired:
 * - rewrite `modifiers_text` so KDS shows the new note
 * - migrate `line_fingerprint` so delta fire / void qty do not double-count
 *
 * Updates lines on tickets still `new` | `in_progress` | `ready` (not done/void).
 * Bumps parent `updated_at` so realtime boards refetch (lines table is not realtime).
 */
export async function syncKitchenTicketLineNote(args: {
  sessionId: string;
  previousFingerprint: string;
  nextLine: CustomerVisitCartLine;
}): Promise<{ updatedLineCount: number }> {
  const plan = planKitchenTicketLineNoteSync(args);
  if (!plan) return { updatedLineCount: 0 };

  const { data: tickets, error: ticketsError } = await supabase
    .from("pos_kitchen_tickets")
    .select("id")
    .eq("session_id", args.sessionId)
    .in("status", ["new", "in_progress", "ready"]);

  if (ticketsError) throw ticketsError;
  const ticketIds = (tickets ?? []).map((t) => String(t.id));
  if (ticketIds.length === 0) return { updatedLineCount: 0 };

  // Prefer rows still keyed by the pre-edit fingerprint.
  let { data: lines, error: linesError } = await supabase
    .from("pos_kitchen_ticket_lines")
    .select("id, ticket_id")
    .in("ticket_id", ticketIds)
    .eq("line_fingerprint", plan.previousFingerprint);

  if (linesError) throw linesError;

  // Idempotent re-save: fingerprint already migrated; still refresh modifiers_text.
  if ((!lines || lines.length === 0) && plan.fingerprintChanged) {
    const retry = await supabase
      .from("pos_kitchen_ticket_lines")
      .select("id, ticket_id")
      .in("ticket_id", ticketIds)
      .eq("line_fingerprint", plan.nextFingerprint);
    if (retry.error) throw retry.error;
    lines = retry.data;
  } else if ((!lines || lines.length === 0) && !plan.fingerprintChanged) {
    // Same fingerprint — nothing to find under previous (already queried). Done.
    return { updatedLineCount: 0 };
  }

  if (!lines?.length) return { updatedLineCount: 0 };

  const touchedTicketIds = new Set<string>();
  for (const row of lines) {
    const { error } = await supabase
      .from("pos_kitchen_ticket_lines")
      .update({
        line_fingerprint: plan.nextFingerprint,
        modifiers_text: plan.modifiersText,
      })
      .eq("id", row.id);
    if (error) throw error;
    touchedTicketIds.add(String(row.ticket_id));
  }

  const now = new Date().toISOString();
  for (const ticketId of touchedTicketIds) {
    const { error: bumpError } = await supabase
      .from("pos_kitchen_tickets")
      .update({ updated_at: now })
      .eq("id", ticketId)
      .in("status", ["new", "in_progress", "ready"]);
    if (bumpError) throw bumpError;
  }

  return { updatedLineCount: lines.length };
}
