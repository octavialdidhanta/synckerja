import type { TableOccupancyState } from "@/8-2-9-table-management/sessions";

export type PaidSeatingSessionLike = {
  status: string;
  sales_activity_id?: string | null;
  pos_table_id?: string | null;
};

/**
 * Open session that is already paid (pay-first dine-in seating).
 * Unpaid bills are open with an empty sales_activity_id and a cart.
 */
export function isPaidSeatingSession(
  session: PaidSeatingSessionLike | null | undefined,
): boolean {
  if (!session) return false;
  return session.status === "open" && Boolean(session.sales_activity_id);
}

/** Empty or partial tables can take a pay-first seating; full tables cannot. */
export function canPickTableForPayFirst(occupancy: {
  state: TableOccupancyState;
}): boolean {
  return occupancy.state !== "full";
}

export type ClearSeatedSessionUpdate = {
  status: "paid";
  closed_at: string;
  closed_by: string | null;
};

/** Close a paid-seating OPEN session without refund, stock reverse, or KDS auto-done. */
export function planClearSeatedSessionUpdate(args: {
  nowIso: string;
  closedBy: string | null;
}): ClearSeatedSessionUpdate {
  return {
    status: "paid",
    closed_at: args.nowIso,
    closed_by: args.closedBy,
  };
}

/** Contract for clearSeatedOpenSession — must not run these side effects. */
export const CLEAR_SEATED_FORBIDDEN_SIDE_EFFECTS = [
  "cancelSessionStockByPolicy",
  "markKitchenTicketsDoneForSession",
  "refundSalesActivity",
] as const;
