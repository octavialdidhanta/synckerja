import { describe, expect, it } from "vitest";
import type { RecipeDraftReview, RecipeDraftReviewRow } from "../types";
import { computeRecipeDraftEdit, editLinesFromReview, newEditLine } from "./recipeDraftEdit";
import { rupiah, signedRupiah } from "./recipeDraftFormat";
import {
  convertToIngredientUnit,
  friendlyQty,
  naturalInput,
  parseQtyInput,
  storedQty,
} from "./recipeDraftUnits";

function row(partial: Partial<RecipeDraftReviewRow> & Pick<RecipeDraftReviewRow, "ingredient_id" | "name">): RecipeDraftReviewRow {
  return {
    unit_code: "kg",
    kind: "raw",
    deleted: false,
    unit_cost: 0,
    has_cost: false,
    before_qty: null,
    after_qty: null,
    before_cost: 0,
    after_cost: 0,
    delta_cost: 0,
    change: "same",
    unusual: false,
    ...partial,
  };
}

// Same numbers as the rolled-back database test of publish_recipe_draft.
const review = {
  has_live_recipe: true,
  selling_price: 35000,
  rows: [
    row({ ingredient_id: "ayam", name: "Daging Ayam", unit_cost: 40000, has_cost: true, before_qty: 0.15, after_qty: 0.18 }),
    row({ ingredient_id: "bumbu", name: "Bumbu Kacang", unit_cost: 60000, has_cost: true, before_qty: 0.03, after_qty: 0.03 }),
    row({ ingredient_id: "tusuk", name: "Tusuk Sate", unit_code: "pcs", unit_cost: 110, has_cost: true, before_qty: 10, after_qty: 10 }),
    row({ ingredient_id: "lontong", name: "Lontong", unit_code: "pcs", unit_cost: 2500, has_cost: true, before_qty: 1, after_qty: null }),
    row({ ingredient_id: "kecap", name: "Kecap Manis", unit_code: "l", before_qty: null, after_qty: 0.015 }),
    row({ ingredient_id: "jeruk", name: "Jeruk Limau", unit_code: "pcs", unit_cost: 500, has_cost: true, before_qty: null, after_qty: 1 }),
  ],
} as unknown as RecipeDraftReview;

describe("recipe draft units", () => {
  it("converts within mass and volume, never across", () => {
    expect(convertToIngredientUnit(180, "g", "kg")).toBeCloseTo(0.18);
    expect(convertToIngredientUnit(15, "ml", "l")).toBeCloseTo(0.015);
    expect(convertToIngredientUnit(0.2, "kg", "g")).toBeCloseTo(200);
    expect(convertToIngredientUnit(10, "pcs", "pcs")).toBe(10);
    expect(convertToIngredientUnit(5, "g", "pcs")).toBeNull();
    expect(convertToIngredientUnit(5, "ml", "kg")).toBeNull();
  });

  it("shows quantities the way people read them", () => {
    expect(naturalInput(0.15, "kg")).toEqual({ value: 150, unit: "g" });
    expect(naturalInput(1.5, "kg")).toEqual({ value: 1.5, unit: "kg" });
    expect(friendlyQty(0.015, "l")).toBe("15 ml");
    expect(friendlyQty(10, "pcs")).toBe("10 pcs");
    expect(storedQty(0.15, "kg")).toBe("0,15 kg");
    expect(storedQty(10, "pcs")).toBeNull();
  });

  it("parses comma or dot decimals and rejects junk", () => {
    expect(parseQtyInput("1,5")).toBe(1.5);
    expect(parseQtyInput(" 180 ")).toBe(180);
    expect(parseQtyInput("")).toBeNull();
    expect(parseQtyInput("abc")).toBeNull();
    expect(parseQtyInput("1.2.3")).toBeNull();
  });
});

describe("computeRecipeDraftEdit", () => {
  it("matches the server totals and warnings for an unedited draft", () => {
    const result = computeRecipeDraftEdit({
      lines: editLinesFromReview(review),
      sellingPrice: 35000,
      hasLiveRecipe: true,
    });
    expect(Math.round(result.totals.hppBefore ?? 0)).toBe(11400);
    expect(Math.round(result.totals.hppAfter)).toBe(10600);
    expect(Math.round(result.totals.delta ?? 0)).toBe(-800);
    expect(result.warnings.map((w) => w.code)).toEqual(["missing_cost", "removed_ingredient"]);
    expect(result.errorCount).toBe(0);
    expect(result.payload).toEqual([
      { ingredient_id: "ayam", quantity: 0.18 },
      { ingredient_id: "bumbu", quantity: 0.03 },
      { ingredient_id: "tusuk", quantity: 10 },
      { ingredient_id: "kecap", quantity: 0.015 },
      { ingredient_id: "jeruk", quantity: 1 },
    ]);
    const changes = Object.fromEntries(result.lines.map((l) => [l.ingredientId, l.change]));
    expect(changes).toEqual({ ayam: "changed", bumbu: "same", tusuk: "same", lontong: "removed", kecap: "new", jeruk: "new" });
  });

  it("flags a g/kg slip, an empty input, and a large HPP jump", () => {
    const lines = editLinesFromReview(review).map((l) =>
      l.ingredientId === "ayam" ? { ...l, input: "1800" } : l.ingredientId === "bumbu" ? { ...l, input: "" } : l,
    );
    const result = computeRecipeDraftEdit({ lines, sellingPrice: 35000, hasLiveRecipe: true });
    const ayam = result.lines.find((l) => l.ingredientId === "ayam");
    expect(ayam?.qty).toBe(1.8);
    expect(ayam?.unusual).toBe(true);
    expect(result.lines.find((l) => l.ingredientId === "bumbu")?.error).toBe("required");
    expect(result.errorCount).toBe(1);
    expect(result.warnings.map((w) => w.code)).toContain("unusual_quantity");
    expect(result.warnings.map((w) => w.code)).toContain("hpp_change");
    expect(result.payload.some((p) => p.ingredient_id === "bumbu")).toBe(false);
  });

  it("restores a removed line, rounds to 3 decimals, and blocks deleted ingredients", () => {
    const lines = editLinesFromReview(review).map((l) => {
      if (l.ingredientId === "lontong") return { ...l, removed: false };
      if (l.ingredientId === "kecap") return { ...l, input: "0,4", inputUnit: "ml" };
      if (l.ingredientId === "jeruk") return { ...l, deleted: true };
      return l;
    });
    const result = computeRecipeDraftEdit({ lines, sellingPrice: 35000, hasLiveRecipe: true });
    expect(result.lines.find((l) => l.ingredientId === "lontong")?.change).toBe("same");
    expect(result.lines.find((l) => l.ingredientId === "kecap")?.error).toBe("too_small");
    expect(result.blocking).toEqual([{ code: "deleted_ingredient", items: ["Jeruk Limau"] }]);
  });

  it("starts an added ingredient empty so the person must type a quantity", () => {
    const added = newEditLine({ ingredientId: "garam", name: "Garam", unitCode: "kg", unitCost: 12000, hasCost: true });
    expect(added.inputUnit).toBe("g");
    const result = computeRecipeDraftEdit({ lines: [added], sellingPrice: 35000, hasLiveRecipe: false });
    expect(result.lines[0].change).toBe("new");
    expect(result.lines[0].error).toBe("required");
    expect(result.totals.hppBefore).toBeNull();
  });
});

describe("format", () => {
  it("formats rupiah with signs", () => {
    expect(rupiah(10600)).toBe("Rp10.600");
    expect(signedRupiah(1200)).toBe("+Rp1.200");
    expect(signedRupiah(-2500)).toBe("−Rp2.500");
    expect(signedRupiah(0.2)).toBe("Rp0");
  });
});
