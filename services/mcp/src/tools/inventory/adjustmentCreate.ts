import { z } from "zod";

function decimalPlaces(value: number): number {
  const text = value.toString();
  if (text.includes("e") || text.includes("E")) return 99;
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * Correct the stock of one tracked item at one outlet (stock adjustment).
 * Give exactly one of set_to (the counted stock) or change (+/- amount). A reason is required.
 * Owner, organization admin, or omnichannel admin only.
 */
export const adjustmentPreviewInput = z.object({
  outlet_id: z.string().uuid(),
  item: z.string().trim().min(1).max(200),
  set_to: z.number().min(0).max(1000000000).optional(),
  change: z.number().min(-1000000000).max(1000000000).optional(),
  reason: z.string().trim().min(1).max(500),
}).strict().superRefine((value, ctx) => {
  const given = Number(value.set_to !== undefined) + Number(value.change !== undefined);
  if (given !== 1
    || (value.set_to !== undefined && decimalPlaces(value.set_to) > 3)
    || (value.change !== undefined && (value.change === 0 || decimalPlaces(value.change) > 3))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_input" });
  }
});

export type AdjustmentPreviewInput = {
  outletId: string;
  item: string;
  setTo: number | null;
  change: number | null;
  reason: string;
};

/** What the confirm token carries: the resolved item, the stock the user saw, and the change. */
export type AdjustmentWriteInput = {
  outletId: string;
  kind: "ingredient" | "product";
  productId: string | null;
  variantId: string | null;
  ingredientId: string | null;
  qtyBefore: number;
  qtyChange: number;
  reason: string;
};

export function adjustmentPreviewArgs(data: z.infer<typeof adjustmentPreviewInput>): AdjustmentPreviewInput {
  return {
    outletId: data.outlet_id,
    item: data.item,
    setTo: data.set_to ?? null,
    change: data.change ?? null,
    reason: data.reason,
  };
}

const confirmedPayload = z.object({
  outletId: z.string().uuid(),
  kind: z.enum(["ingredient", "product"]),
  productId: z.string().uuid().nullable(),
  variantId: z.string().uuid().nullable(),
  ingredientId: z.string().uuid().nullable(),
  qtyBefore: z.number(),
  qtyChange: z.number().refine((value) => value !== 0),
  reason: z.string().trim().min(1).max(500),
}).strict();

/** Rebuild the input from a verified confirm token; rejects anything the preview would not have produced. */
export function adjustmentInputFromConfirmation(payload: Record<string, unknown>): AdjustmentWriteInput {
  const parsed = confirmedPayload.safeParse(payload);
  if (!parsed.success) throw new Error("confirmation_invalid");
  const value = parsed.data;
  const ok = value.kind === "ingredient"
    ? value.ingredientId !== null && value.productId === null && value.variantId === null
    : value.productId !== null && value.ingredientId === null;
  if (!ok) throw new Error("confirmation_invalid");
  return value;
}

/** Builds the token payload from the preview result. */
export function adjustmentWriteFromPreview(preview: Record<string, unknown>, reason: string): AdjustmentWriteInput {
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  return adjustmentInputFromConfirmation({
    outletId: text(preview.outlet_id),
    kind: preview.kind,
    productId: text(preview.product_id),
    variantId: text(preview.variant_id),
    ingredientId: text(preview.ingredient_id),
    qtyBefore: Number(preview.qty_before),
    qtyChange: Number(preview.qty_change),
    reason,
  });
}

export const ADJUSTMENT_HOW_TO_READ =
  "Show the user: the item, the outlet, stock qty_before → qty_after (qty_change), and the reason. "
  + "Nothing is saved yet; ask the user to confirm before calling inventory.adjustment.create. "
  + "The adjustment appears on the Adjustment tab with the reason and \"(lewat chat)\".";
