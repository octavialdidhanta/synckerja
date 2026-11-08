import { z } from "zod";

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

export function purchaseOrderWriteInput(data: z.infer<typeof purchaseOrderInput>): InventoryPurchaseOrderInput {
  return {
    outletId: data.outlet_id,
    search: data.search,
    qty: data.qty,
    unitCost: data.unit_cost,
    supplierId: data.supplier_id ?? null,
    note: data.note ? data.note : null,
  };
}

/** Rebuild the input from a verified confirm token; rejects anything the preview would not have produced. */
export function purchaseOrderInputFromConfirmation(payload: Record<string, unknown>): InventoryPurchaseOrderInput {
  const parsed = purchaseOrderInput.safeParse({
    outlet_id: payload.outletId,
    search: payload.search,
    qty: payload.qty,
    unit_cost: payload.unitCost,
    ...(typeof payload.supplierId === "string" ? { supplier_id: payload.supplierId } : {}),
    ...(typeof payload.note === "string" ? { note: payload.note } : {}),
  });
  if (!parsed.success) throw new Error("confirmation_invalid");
  return purchaseOrderWriteInput(parsed.data);
}
