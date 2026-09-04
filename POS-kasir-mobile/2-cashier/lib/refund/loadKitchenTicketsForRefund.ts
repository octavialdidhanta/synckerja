import { supabase } from "@/shared/lib/supabaseClient";
import type { PosKitchenTicketStatus } from "@/pos-mobile/8-kitchen/lib/posKitchenTypes";
import { resolveRefundStockPolicy, type RefundStockPolicy } from "./resolveRefundStockPolicy";

export type KitchenTicketRefundRow = {
  id: string;
  status: PosKitchenTicketStatus;
};

const STATUSES: readonly PosKitchenTicketStatus[] = [
  "new",
  "in_progress",
  "ready",
  "done",
  "void",
];

function asTicketStatus(value: string): PosKitchenTicketStatus {
  if (STATUSES.includes(value as PosKitchenTicketStatus)) {
    return value as PosKitchenTicketStatus;
  }
  // Unknown rows are treated as started so cooked stock is never restored by accident.
  return "done";
}

export async function loadKitchenTicketsForRefund(
  sessionId: string,
): Promise<KitchenTicketRefundRow[]> {
  const { data, error } = await supabase
    .from("pos_kitchen_tickets")
    .select("id, status")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    status: asTicketStatus(String((row as { status: string }).status ?? "")),
  }));
}

export async function loadRefundStockPolicy(
  sessionId: string | null | undefined,
): Promise<RefundStockPolicy> {
  const id = sessionId?.trim();
  if (!id) return "restore";
  const tickets = await loadKitchenTicketsForRefund(id);
  return resolveRefundStockPolicy(tickets);
}
