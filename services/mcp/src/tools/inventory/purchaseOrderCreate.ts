import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { InventoryPurchaseOrder } from "../../db/inventoryPurchaseOrder";

function decimalPlaces(value: number): number {
  const text = value.toString();
  if (text.includes("e") || text.includes("E")) return 99;
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function subtotal(qty: number, unitCost: number): number {
  return Math.round((qty * unitCost + Number.EPSILON) * 100) / 100;
}

export const purchaseOrderInput = z.object({
  outlet_id: z.string().uuid(),
  search: z.string().trim().min(1).max(200),
  qty: z.number().positive().max(99999999999.999),
  unit_cost: z.number().positive().max(999999999999.99),
  supplier_id: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
}).strict().superRefine((value, ctx) => {
  if (decimalPlaces(value.qty) > 3 || subtotal(value.qty, value.unit_cost) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_input" });
  }
});

export type InventoryPurchaseOrderInput = {
  outletId: string;
  search: string;
  qty: number;
  unitCost: number;
  supplierId: string | null;
  note: string | null;
};

export function purchaseOrderResult(
  ctx: McpAuthContext,
  input: InventoryPurchaseOrderInput,
  create: (ctx: McpAuthContext, input: InventoryPurchaseOrderInput) => Promise<InventoryPurchaseOrder>,
): Promise<InventoryPurchaseOrder> {
  return create(ctx, input);
}
