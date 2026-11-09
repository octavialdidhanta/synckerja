import type { RecipeDraftChange, RecipeDraftNotice, RecipeDraftReview } from "../types";
import {
  convertToIngredientUnit,
  formatQty,
  inputUnitOptions,
  naturalInput,
  parseQtyInput,
  roundRecipeQty,
} from "./recipeDraftUnits";

/**
 * Client-side model for editing a draft before publish. It mirrors the server rules in
 * _recipe_draft_review so the person sees the same HPP and warnings while typing; the server
 * recomputes everything on save and publish and stays the authority.
 */

export type RecipeDraftEditLine = {
  ingredientId: string;
  name: string;
  unitCode: string;
  unitCost: number;
  hasCost: boolean;
  beforeQty: number | null;
  deleted: boolean;
  input: string;
  inputUnit: string;
  removed: boolean;
};

export type RecipeDraftLineError = "required" | "unit" | "too_small" | "too_large";

export type RecipeDraftComputedLine = RecipeDraftEditLine & {
  qty: number | null;
  error: RecipeDraftLineError | null;
  unusual: boolean;
  change: RecipeDraftChange;
  beforeCost: number;
  afterCost: number;
  deltaCost: number;
  unitOptions: string[];
};

export type RecipeDraftComputed = {
  lines: RecipeDraftComputedLine[];
  totals: {
    hppBefore: number | null;
    hppAfter: number;
    delta: number | null;
    marginAfter: number;
    marginPctAfter: number | null;
  };
  warnings: RecipeDraftNotice[];
  blocking: RecipeDraftNotice[];
  errorCount: number;
  payload: Array<{ ingredient_id: string; quantity: number }>;
};

export function editLinesFromReview(review: RecipeDraftReview): RecipeDraftEditLine[] {
  return review.rows.map((row) => {
    const unit = row.unit_code ?? "";
    const qty = row.after_qty ?? row.before_qty ?? 0;
    const natural = naturalInput(qty, unit);
    return {
      ingredientId: row.ingredient_id,
      name: row.name,
      unitCode: unit,
      unitCost: Number(row.unit_cost) || 0,
      hasCost: row.has_cost,
      beforeQty: row.before_qty,
      deleted: row.deleted,
      input: qty ? formatQty(natural.value) : "",
      inputUnit: natural.unit,
      removed: row.after_qty == null,
    };
  });
}

export function newEditLine(args: {
  ingredientId: string;
  name: string;
  unitCode: string;
  unitCost: number;
  hasCost: boolean;
}): RecipeDraftEditLine {
  return {
    ingredientId: args.ingredientId,
    name: args.name,
    unitCode: args.unitCode,
    unitCost: args.unitCost,
    hasCost: args.hasCost,
    beforeQty: null,
    deleted: false,
    input: "",
    inputUnit: inputUnitOptions(args.unitCode)[0] ?? args.unitCode,
    removed: false,
  };
}

function isUnusual(qty: number, unitCode: string, beforeQty: number | null): boolean {
  const unit = unitCode.toLowerCase();
  if ((unit === "kg" || unit === "l") && qty > 1) return true;
  if ((unit === "g" || unit === "ml") && qty > 1000) return true;
  return beforeQty != null && beforeQty > 0 && qty / beforeQty >= 5;
}

export function computeRecipeDraftEdit(args: {
  lines: RecipeDraftEditLine[];
  sellingPrice: number;
  hasLiveRecipe: boolean;
}): RecipeDraftComputed {
  let errorCount = 0;
  let before = 0;
  let after = 0;

  const lines: RecipeDraftComputedLine[] = args.lines.map((line) => {
    let qty: number | null = null;
    let error: RecipeDraftLineError | null = null;
    if (!line.removed) {
      const parsed = parseQtyInput(line.input);
      if (parsed == null || parsed <= 0) {
        error = "required";
      } else {
        const converted = convertToIngredientUnit(parsed, line.inputUnit, line.unitCode);
        if (converted == null) error = "unit";
        else {
          const rounded = roundRecipeQty(converted);
          if (rounded <= 0) error = "too_small";
          else if (rounded > 100000) error = "too_large";
          else qty = rounded;
        }
      }
    }
    if (error) errorCount += 1;

    const beforeCost = (line.beforeQty ?? 0) * line.unitCost;
    const afterCost = (qty ?? 0) * line.unitCost;
    before += beforeCost;
    after += afterCost;

    let change: RecipeDraftChange = "same";
    if (line.removed) change = "removed";
    else if (line.beforeQty == null) change = "new";
    else if (qty == null || qty !== line.beforeQty) change = "changed";

    return {
      ...line,
      qty,
      error,
      unusual: qty != null && isUnusual(qty, line.unitCode, line.beforeQty),
      change,
      beforeCost,
      afterCost,
      deltaCost: afterCost - beforeCost,
      unitOptions: inputUnitOptions(line.unitCode),
    };
  });

  const names = (pick: (line: RecipeDraftComputedLine) => boolean) => lines.filter(pick).map((line) => line.name);
  const warnings: RecipeDraftNotice[] = [];
  const missing = names((l) => !l.removed && !l.hasCost && !l.deleted);
  if (missing.length) warnings.push({ code: "missing_cost", items: missing });
  const unusual = names((l) => l.unusual);
  if (unusual.length) warnings.push({ code: "unusual_quantity", items: unusual });
  const removed = names((l) => l.removed && l.beforeQty != null);
  if (removed.length) warnings.push({ code: "removed_ingredient", items: removed });
  if (args.hasLiveRecipe && before > 0 && Math.abs(after - before) / before > 0.2) {
    warnings.push({ code: "hpp_change", percent: Math.round(((after - before) / before) * 1000) / 10 });
  }

  const blocking: RecipeDraftNotice[] = [];
  const deleted = names((l) => !l.removed && l.deleted);
  if (deleted.length) blocking.push({ code: "deleted_ingredient", items: deleted });
  if (lines.every((l) => l.removed)) blocking.push({ code: "empty" });

  const price = args.sellingPrice;
  return {
    lines,
    totals: {
      hppBefore: args.hasLiveRecipe ? before : null,
      hppAfter: after,
      delta: args.hasLiveRecipe ? after - before : null,
      marginAfter: price - after,
      marginPctAfter: price > 0 ? ((price - after) / price) * 100 : null,
    },
    warnings,
    blocking,
    errorCount,
    payload: lines
      .filter((l) => !l.removed && l.qty != null)
      .map((l) => ({ ingredient_id: l.ingredientId, quantity: l.qty as number })),
  };
}
