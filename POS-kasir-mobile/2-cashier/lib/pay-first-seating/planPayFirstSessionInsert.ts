import { isDineInSalesType } from "./isDineInSalesType";

export type PayFirstSessionInsertPlan = {
  status: "open" | "paid";
  closed_at: string | null;
  closed_by: string | null;
  cart_snapshot: [];
  pax: number;
};

/**
 * Pay-first insert without an existing open bill.
 * Dine in stays OPEN so the floor plan can occupy a table after pick.
 * Takeaway / delivery / pickup close as paid immediately.
 */
export function shouldKeepPayFirstSessionOpen(args: {
  existingSessionId?: string | null;
  salesTypeLabel?: string | null;
}): boolean {
  if (args.existingSessionId) return false;
  return isDineInSalesType(args.salesTypeLabel);
}

export function planPayFirstSessionInsert(args: {
  keepOpen: boolean;
  nowIso: string;
  closedBy: string | null;
  pax?: number;
}): PayFirstSessionInsertPlan {
  if (args.keepOpen) {
    return {
      status: "open",
      closed_at: null,
      closed_by: null,
      cart_snapshot: [],
      pax: 1,
    };
  }
  return {
    status: "paid",
    closed_at: args.nowIso,
    closed_by: args.closedBy,
    cart_snapshot: [],
    pax: Math.max(1, args.pax ?? 1),
  };
}
