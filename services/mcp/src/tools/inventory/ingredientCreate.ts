import { z } from "zod";

/** Same codes as the Ingredient page unit picker (src/8-2-3-ingredient/library/lib/ingredientUnits.ts). */
export const INGREDIENT_UNIT_CODES = [
  "pcs", "box", "bks", "btr", "cm", "c", "ekr", "fl oz", "gal", "g", "grs", "ikt", "in", "jar", "klg",
  "kds", "ktn", "krg", "kg", "crt", "kw", "lbr", "l", "lsn", "m", "mg", "ml", "ons", "oz", "pck", "pt",
  "prs", "ptg", "lb", "q", "sct", "tbsp", "tsp", "tn", "whole",
] as const;

function decimalPlaces(value: number): number {
  const text = value.toString();
  if (text.includes("e") || text.includes("E")) return 99;
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * Every field the page needs is required, so the assistant cannot call this without asking.
 * Category is an explicit choice: a category_name, or no_category: true when the user said
 * they want no category. Sending neither (or both) is rejected, so a missing answer cannot
 * silently become "Uncategorized".
 */
export const ingredientPreviewInput = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  unit_code: z.enum(INGREDIENT_UNIT_CODES),
  category_name: z.string().trim().min(1).max(80).optional(),
  no_category: z.literal(true).optional(),
  opening_stock: z.number().min(0).max(99999999999.999),
  unit_cost: z.number().min(0).max(999999999999.99),
  alert_at: z.number().min(0).max(99999999999.999).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.category_name == null) === (value.no_category !== true)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ingredient_category_choice_required" });
  }
  if (decimalPlaces(value.opening_stock) > 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_input" });
  }
  if (value.opening_stock > 0 && value.unit_cost <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ingredient_cost_required" });
  }
});

export type IngredientWriteInput = {
  outletId: string;
  name: string;
  unitCode: string;
  categoryName: string | null;
  openingStock: number;
  unitCost: number;
  alertAt: number | null;
};

export function ingredientWriteInput(data: z.infer<typeof ingredientPreviewInput>): IngredientWriteInput {
  const category = data.no_category ? "" : data.category_name?.trim() ?? "";
  return {
    outletId: data.outlet_id,
    name: data.name,
    unitCode: data.unit_code,
    categoryName: category ? category : null,
    openingStock: data.opening_stock,
    unitCost: data.unit_cost,
    alertAt: data.alert_at ?? null,
  };
}

/** Rebuild the input from a verified confirm token; rejects anything the preview would not have produced. */
export function ingredientInputFromConfirmation(payload: Record<string, unknown>): IngredientWriteInput {
  const parsed = ingredientPreviewInput.safeParse({
    outlet_id: payload.outletId,
    name: payload.name,
    unit_code: payload.unitCode,
    ...(typeof payload.categoryName === "string" && payload.categoryName
      ? { category_name: payload.categoryName }
      : { no_category: true }),
    opening_stock: payload.openingStock,
    unit_cost: payload.unitCost,
    alert_at: payload.alertAt ?? null,
  });
  if (!parsed.success) throw new Error("confirmation_invalid");
  return ingredientWriteInput(parsed.data);
}
