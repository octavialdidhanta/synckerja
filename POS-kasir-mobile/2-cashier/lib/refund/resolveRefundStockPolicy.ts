import type { PosKitchenTicketStatus } from "@/pos-mobile/8-kitchen/lib/posKitchenTypes";

export type RefundStockPolicy = "restore" | "waste";

export const POS_REFUND_WASTE_REASON_MIN_LEN = 3;
export const POS_REFUND_WASTE_REASON_REQUIRED = "pos_refund_waste_reason_required";

const COOKED_STATUSES = new Set<PosKitchenTicketStatus>([
  "in_progress",
  "ready",
  "done",
]);

/** Restore stock only when kitchen never started (no live tickets, or all still `new`). */
export function resolveRefundStockPolicy(
  tickets: readonly { status: PosKitchenTicketStatus }[],
): RefundStockPolicy {
  const live = tickets.filter((ticket) => ticket.status !== "void");
  if (live.length === 0) return "restore";
  const started = live.some((ticket) => COOKED_STATUSES.has(ticket.status));
  return started ? "waste" : "restore";
}

export function isRefundWasteReasonValid(reason: string | null | undefined): boolean {
  return (reason ?? "").trim().length >= POS_REFUND_WASTE_REASON_MIN_LEN;
}

export function canConfirmPosCheckoutRefund(args: {
  policy: RefundStockPolicy | null;
  policyLoading?: boolean;
  busy?: boolean;
  reason: string | null | undefined;
}): boolean {
  if (!args.policy || args.policyLoading || args.busy) return false;
  if (args.policy === "waste") return isRefundWasteReasonValid(args.reason);
  return true;
}

export function assertRefundWasteReason(
  policy: RefundStockPolicy,
  reason: string | null | undefined,
): void {
  if (policy !== "waste") return;
  if (!isRefundWasteReasonValid(reason)) {
    throw new Error(POS_REFUND_WASTE_REASON_REQUIRED);
  }
}
