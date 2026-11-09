import { z } from "zod";

/**
 * Receive an existing purchase order from chat. Same rules as the "Mark as Fulfilled" button:
 * the whole PO is received at its own qty and price (no partial receipt), and when the PO has a
 * purchase request it must be approved and paid, with PO Fulfillment access in Advanced mode.
 */

export const openPurchaseOrdersInput = z.object({
  outlet_id: z.string().uuid().optional(),
}).strict();

export const receivePreviewInput = z.object({
  purchase_order_id: z.string().uuid().optional(),
  order_number: z.string().trim().min(1).max(40).optional(),
  comment: z.string().trim().max(500).optional(),
}).strict().superRefine((value, ctx) => {
  const given = Number(Boolean(value.purchase_order_id)) + Number(Boolean(value.order_number));
  if (given !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_input" });
  }
});

export type ReceivePreviewInput = {
  purchaseOrderId: string | null;
  orderNumber: string | null;
  comment: string | null;
};

/** What the confirm token carries: the resolved PO id and the total the user saw. */
export type ReceiveWriteInput = {
  purchaseOrderId: string;
  expectedTotal: number;
  comment: string | null;
};

export function receivePreviewArgs(data: z.infer<typeof receivePreviewInput>): ReceivePreviewInput {
  return {
    purchaseOrderId: data.purchase_order_id ?? null,
    orderNumber: data.order_number ?? null,
    comment: data.comment ? data.comment : null,
  };
}

const confirmedPayload = z.object({
  purchaseOrderId: z.string().uuid(),
  expectedTotal: z.number().nonnegative(),
  comment: z.string().max(500).nullable(),
}).strict();

/** Rebuild the input from a verified confirm token; rejects anything the preview would not have produced. */
export function receiveInputFromConfirmation(payload: Record<string, unknown>): ReceiveWriteInput {
  const parsed = confirmedPayload.safeParse(payload);
  if (!parsed.success) throw new Error("confirmation_invalid");
  return parsed.data;
}

export const OPEN_PURCHASE_ORDERS_HOW_TO_READ =
  "Each row is a purchase order still waiting to be received. ready_to_receive is true when it can be received now "
  + "(finance_status none or paid). When finance_status is submitted or approved it still needs approval and payment on the Expense pages first. "
  + "To receive one, call inventory.purchase_order.receive.preview with its purchase_order_id. If several could match what the user said, ask which one.";

export const RECEIVE_HOW_TO_READ =
  "Show the user: the order_number, outlet, supplier, every line with qty and stock_now → stock_after_expected, and total_value. "
  + "The whole PO is received at its own qty and price; partial receipt is not supported, so if the goods that arrived differ, "
  + "receive it and correct the difference with a stock adjustment in the app, or ask the user. Nothing is saved yet. "
  + "If can_receive is false, explain blocked_reason and do not offer to confirm: "
  + "catalog_po_payment_required = approve and pay it on the Expense pages first; "
  + "catalog_inventory_feature_forbidden = this user lacks PO Fulfillment access (Inventory Settings); "
  + "catalog_po_not_waiting = it was already received or cancelled.";
