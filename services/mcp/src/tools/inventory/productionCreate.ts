import { z } from "zod";

function decimalPlaces(value: number): number {
  const text = value.toString();
  if (text.includes("e") || text.includes("E")) return 99;
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * Record production of one semi-finished item (e.g. Nasi from Beras) at one outlet.
 * qty is in the semi-finished item's own unit (e.g. 20 prs of Nasi), not batches.
 */
export const productionPreviewInput = z.object({
  outlet_id: z.string().uuid(),
  item: z.string().trim().min(1).max(120),
  qty: z.number().gt(0).max(1000000),
}).strict().superRefine((value, ctx) => {
  if (decimalPlaces(value.qty) > 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_input" });
  }
});

export type ProductionPreviewInput = { outletId: string; item: string; qty: number };

/** What the confirm token carries: the resolved item id, so the write cannot pick another item. */
export type ProductionWriteInput = { outletId: string; itemId: string; qty: number };

export function productionPreviewArgs(data: z.infer<typeof productionPreviewInput>): ProductionPreviewInput {
  return { outletId: data.outlet_id, item: data.item, qty: data.qty };
}

const confirmedPayload = z.object({
  outletId: z.string().uuid(),
  itemId: z.string().uuid(),
  qty: z.number().gt(0).max(1000000),
}).strict();

/** Rebuild the input from a verified confirm token; rejects anything the preview would not have produced. */
export function productionInputFromConfirmation(payload: Record<string, unknown>): ProductionWriteInput {
  const parsed = confirmedPayload.safeParse(payload);
  if (!parsed.success || decimalPlaces(parsed.data.qty) > 3) throw new Error("confirmation_invalid");
  return parsed.data;
}

export const PRODUCTION_HOW_TO_READ =
  "Show the user: the item and qty to produce at the outlet, every ingredient in lines with need and stock_before → stock_after, the cost per unit (unit_cost) and avg_cost_before → avg_cost_after when cost_tracked. If can_produce is false, name the ingredients in short_of and do not offer to confirm: stock must be bought or produced first. Mention without_cost ingredients: they count as Rp0, so the real cost is higher. Nothing is saved yet; ask the user to confirm before calling inventory.production.create.";
