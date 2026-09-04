import { POS_KITCHEN_RECALL_WINDOW_MS } from "./partitionKitchenDoneBoards";

export const KITCHEN_RESTORE_WINDOW_EXPIRED = "kitchen_restore_window_expired";

/**
 * Recall / Revert is only allowed for done tickets inside the 15-minute
 * safety window (same as the Recall board query).
 */
export function isKitchenTicketInRecallWindow(
  ticket: { status?: string | null; completed_at: string | null },
  nowMs = Date.now(),
  windowMs = POS_KITCHEN_RECALL_WINDOW_MS,
): boolean {
  if (ticket.status && ticket.status !== "done") return false;
  if (!ticket.completed_at) return false;
  const completed = Date.parse(ticket.completed_at);
  if (!Number.isFinite(completed)) return false;
  const age = nowMs - completed;
  return age >= 0 && age <= windowMs;
}

export function assertKitchenTicketInRecallWindow(
  ticket: { status?: string | null; completed_at: string | null },
  nowMs = Date.now(),
): void {
  if (!isKitchenTicketInRecallWindow(ticket, nowMs)) {
    throw new Error(KITCHEN_RESTORE_WINDOW_EXPIRED);
  }
}
