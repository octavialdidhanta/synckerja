import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildKitchenTicketLinesFromCart } from "./buildKitchenTicketLinesFromCart";

export type CreatePosKitchenTicketsArgs = {
  organizationId: string;
  outletId: string;
  sessionId: string;
  posTableId?: string | null;
  tableName: string;
  cartLines: CustomerVisitCartLine[];
  createdBy?: string | null;
  customerName?: string | null;
  salesTypeId?: string | null;
  salesTypeLabel?: string | null;
};

/**
 * Insert one KDS ticket + lines for a Simpan Bill send.
 * No-op when there are no product lines. Does not depend on printer prefs.
 */
export async function createPosKitchenTickets(
  args: CreatePosKitchenTicketsArgs,
): Promise<string | null> {
  const lines = buildKitchenTicketLinesFromCart(args.cartLines);
  if (lines.length === 0) return null;

  const tableName = args.tableName.trim() || "Walk-in";
  const customerName = (args.customerName ?? "").trim() || null;
  const salesTypeLabel = (args.salesTypeLabel ?? "").trim() || null;
  const salesTypeId = (args.salesTypeId ?? "").trim() || null;

  const { data: ticket, error: ticketError } = await supabase
    .from("pos_kitchen_tickets")
    .insert({
      organization_id: args.organizationId,
      outlet_id: args.outletId,
      session_id: args.sessionId,
      pos_table_id: args.posTableId ?? null,
      table_name: tableName,
      customer_name: customerName,
      sales_type_id: salesTypeId,
      sales_type_label: salesTypeLabel,
      status: "new",
      created_by: args.createdBy ?? null,
    })
    .select("id")
    .single();

  if (ticketError) throw ticketError;
  if (!ticket?.id) throw new Error("kitchen_ticket_insert_failed");

  const { error: linesError } = await supabase.from("pos_kitchen_ticket_lines").insert(
    lines.map((line) => ({
      ticket_id: ticket.id,
      line_fingerprint: line.line_fingerprint,
      display_name: line.display_name,
      modifiers_text: line.modifiers_text,
      quantity: line.quantity,
      sort_index: line.sort_index,
    })),
  );

  if (linesError) throw linesError;
  return String(ticket.id);
}

/** Mark all active tickets for a paid session as done. */
export async function markKitchenTicketsDoneForSession(
  sessionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("pos_kitchen_tickets")
    .update({ status: "done", completed_at: now })
    .eq("session_id", sessionId)
    .in("status", ["new", "in_progress", "ready"]);
  if (error) throw error;
}

/** Void active tickets when a bill is cancelled. Leaves `done` history intact. */
export async function voidKitchenTicketsForSession(
  sessionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("pos_kitchen_tickets")
    .update({ status: "void", completed_at: now })
    .eq("session_id", sessionId)
    .in("status", ["new", "in_progress", "ready"]);
  if (error) throw error;
}

/** Void live + completed tickets after a paid refund so KDS does not keep cooking. */
export async function voidKitchenTicketsForRefund(
  sessionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("pos_kitchen_tickets")
    .update({ status: "void", completed_at: now })
    .eq("session_id", sessionId)
    .in("status", ["new", "in_progress", "ready", "done"]);
  if (error) throw error;
}

/**
 * Reduce/remove lines on tickets still in `new` for this fingerprint.
 * Cooking/ready tickets are left unchanged (Phase 1).
 */
export async function applyKitchenTicketLineVoid(args: {
  sessionId: string;
  lineFingerprint: string;
  voidQty: number;
}): Promise<void> {
  const voidQty = Math.max(0, Math.round(args.voidQty));
  if (voidQty <= 0) return;

  const { data: tickets, error: ticketsError } = await supabase
    .from("pos_kitchen_tickets")
    .select("id")
    .eq("session_id", args.sessionId)
    .eq("status", "new");

  if (ticketsError) throw ticketsError;
  const ticketIds = (tickets ?? []).map((t) => String(t.id));
  if (ticketIds.length === 0) return;

  const { data: lines, error: linesError } = await supabase
    .from("pos_kitchen_ticket_lines")
    .select("id, ticket_id, quantity")
    .in("ticket_id", ticketIds)
    .eq("line_fingerprint", args.lineFingerprint)
    .order("created_at", { ascending: false });

  if (linesError) throw linesError;
  if (!lines?.length) return;

  let remaining = voidQty;
  for (const line of lines) {
    if (remaining <= 0) break;
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;
    const take = Math.min(qty, remaining);
    const nextQty = qty - take;
    remaining -= take;

    if (nextQty <= 0) {
      const { error } = await supabase
        .from("pos_kitchen_ticket_lines")
        .delete()
        .eq("id", line.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("pos_kitchen_ticket_lines")
        .update({ quantity: nextQty })
        .eq("id", line.id);
      if (error) throw error;
    }
  }

  // Drop empty `new` tickets (no lines left); bump remaining so realtime refreshes.
  for (const ticketId of ticketIds) {
    const { count, error: countError } = await supabase
      .from("pos_kitchen_ticket_lines")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticketId);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      const { error: bumpError } = await supabase
        .from("pos_kitchen_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticketId)
        .eq("status", "new");
      if (bumpError) throw bumpError;
      continue;
    }
    const { error } = await supabase
      .from("pos_kitchen_tickets")
      .update({
        status: "void",
        completed_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .eq("status", "new");
    if (error) throw error;
  }
}
