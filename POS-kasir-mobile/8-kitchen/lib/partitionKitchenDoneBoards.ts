import type { PosKitchenTicket } from "./posKitchenTypes";

/** Short safety-net window for “oops, bumped too soon”. */
export const POS_KITCHEN_RECALL_WINDOW_MS = 15 * 60 * 1000;

/** Cap recall stack size (most recently completed first). */
export const POS_KITCHEN_RECALL_MAX = 10;

function completedAtMs(ticket: PosKitchenTicket): number {
  if (!ticket.completed_at) return 0;
  const ms = Date.parse(ticket.completed_at);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Recall = recent done tickets only (within window, max N), newest first.
 * Not an archive — Completed history is separate.
 */
export function selectKitchenRecallTickets(
  done: readonly PosKitchenTicket[],
  nowMs = Date.now(),
): PosKitchenTicket[] {
  const since = nowMs - POS_KITCHEN_RECALL_WINDOW_MS;
  return [...done]
    .filter((t) => t.status === "done" && completedAtMs(t) >= since)
    .sort((a, b) => completedAtMs(b) - completedAtMs(a))
    .slice(0, POS_KITCHEN_RECALL_MAX);
}

/**
 * Completed (today) history excludes tickets still on the Recall stack
 * so sidebar badges do not double-count the same cards.
 */
export function selectKitchenCompletedHistoryTickets(
  doneToday: readonly PosKitchenTicket[],
  recall: readonly PosKitchenTicket[],
): PosKitchenTicket[] {
  const recallIds = new Set(recall.map((t) => t.id));
  return doneToday.filter((t) => !recallIds.has(t.id));
}
