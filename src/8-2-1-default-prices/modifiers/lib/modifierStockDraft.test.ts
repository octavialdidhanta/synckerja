import { describe, expect, it } from "vitest";
import {
  parseModifierStockQty,
  validateModifierStockDrafts,
  type ModifierStockOptionDraft,
} from "./modifierStockDraft";

function row(partial: Partial<ModifierStockOptionDraft> & { key: string }): ModifierStockOptionDraft {
  return {
    optionName: "Keju",
    ingredientId: "ing-1",
    quantityDisplay: "1",
    ...partial,
  };
}

describe("parseModifierStockQty", () => {
  it("parses positive numbers", () => {
    expect(parseModifierStockQty("1")).toBe(1);
    expect(parseModifierStockQty("2,5")).toBe(2.5);
  });

  it("rejects empty or non-positive", () => {
    expect(parseModifierStockQty("")).toBeNull();
    expect(parseModifierStockQty("0")).toBeNull();
    expect(parseModifierStockQty("-1")).toBeNull();
  });
});

describe("validateModifierStockDrafts", () => {
  it("skips validation when stock disabled", () => {
    expect(
      validateModifierStockDrafts(false, [row({ ingredientId: null, quantityDisplay: "" })]),
    ).toEqual({ ok: true });
  });

  it("requires ingredient and qty when stock enabled", () => {
    const result = validateModifierStockDrafts(true, [
      row({ key: "a", ingredientId: null }),
      row({ key: "b", quantityDisplay: "" }),
      row({ key: "c" }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missingKeys).toEqual(["a", "b"]);
  });
});
