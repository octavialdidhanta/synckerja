import type { PosKitchenTicket } from "./posKitchenTypes";

/** Effective wait ms accounting for Hold pauses. */
export function kitchenTicketElapsedMs(
  ticket: Pick<PosKitchenTicket, "created_at" | "is_held" | "held_at" | "pause_ms">,
  nowMs: number,
): number {
  const created = new Date(ticket.created_at).getTime();
  if (!Number.isFinite(created)) return 0;
  const pauseMs = Math.max(0, Number(ticket.pause_ms) || 0);
  if (ticket.is_held && ticket.held_at) {
    const held = new Date(ticket.held_at).getTime();
    if (Number.isFinite(held)) {
      return Math.max(0, held - created - pauseMs);
    }
  }
  return Math.max(0, nowMs - created - pauseMs);
}

/** Short display code like #Sale-25A211I6 from ticket uuid. */
export function formatKitchenTicketCode(ticketId: string): string {
  const compact = ticketId.replace(/-/g, "").slice(-8).toUpperCase();
  return `#Sale-${compact}`;
}

export function kitchenTicketReadiness(lines: { is_done: boolean }[]): {
  done: number;
  total: number;
  percent: number;
} {
  const total = lines.length;
  const done = lines.filter((l) => l.is_done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}
