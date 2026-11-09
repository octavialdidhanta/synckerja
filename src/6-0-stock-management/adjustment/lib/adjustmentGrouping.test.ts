import { describe, expect, it } from "vitest";
import { adjustmentMovementValue, groupAdjustmentMovements, summarizeAdjustmentBatches } from "./adjustmentGrouping";
import { formatSignedRupiah } from "./adjustmentValueFormat";

describe("adjustmentGrouping", () => {
  it("groups movements by reference_id and sums qty_delta", () => {
    const batches = groupAdjustmentMovements([
      {
        id: "m1",
        reference_id: "batch-1",
        reference_type: "inventory_adjustment",
        note: "note",
        occurred_at: "2026-08-20T10:00:00.000Z",
        item_kind: "product",
        product_id: "p1",
        variant_id: null,
        ingredient_id: null,
        qty_delta: 1,
        qty_after: 501,
      },
      {
        id: "m2",
        reference_id: "batch-1",
        reference_type: "inventory_adjustment",
        note: "note",
        occurred_at: "2026-08-20T10:05:00.000Z",
        item_kind: "product",
        product_id: "p2",
        variant_id: "v1",
        ingredient_id: null,
        qty_delta: -2,
        qty_after: 498,
      },
    ]);

    expect(batches).toHaveLength(1);
    expect(batches[0].referenceId).toBe("batch-1");
    expect(batches[0].itemKind).toBe("product");
    expect(batches[0].totalQtyDelta).toBe(-1);
    expect(batches[0].lines).toHaveLength(2);
  });

  it("falls back to movement id when reference_id is null", () => {
    const batches = groupAdjustmentMovements([
      {
        id: "m1",
        reference_id: null,
        reference_type: null,
        note: null,
        occurred_at: "2026-08-20T10:00:00.000Z",
        item_kind: "product",
        product_id: "p1",
        variant_id: null,
        ingredient_id: null,
        qty_delta: 1,
        qty_after: 101,
      },
      {
        id: "m2",
        reference_id: null,
        reference_type: null,
        note: null,
        occurred_at: "2026-08-20T10:00:00.000Z",
        item_kind: "product",
        product_id: "p1",
        variant_id: null,
        ingredient_id: null,
        qty_delta: 2,
        qty_after: 102,
      },
    ]);
    expect(batches).toHaveLength(2);
  });

  it("groups ingredient movements by reference_id and sums qty_delta", () => {
    const batches = groupAdjustmentMovements([
      {
        id: "m1",
        reference_id: "batch-ingredient-1",
        reference_type: "inventory_adjustment",
        note: "note",
        occurred_at: "2026-08-20T10:00:00.000Z",
        item_kind: "ingredient",
        product_id: null,
        variant_id: null,
        ingredient_id: "i1",
        qty_delta: 3,
        qty_after: 13,
      },
      {
        id: "m2",
        reference_id: "batch-ingredient-1",
        reference_type: "inventory_adjustment",
        note: "note",
        occurred_at: "2026-08-20T10:05:00.000Z",
        item_kind: "ingredient",
        product_id: null,
        variant_id: null,
        ingredient_id: "i2",
        qty_delta: -1,
        qty_after: 7,
      },
    ]);

    expect(batches).toHaveLength(1);
    expect(batches[0].referenceId).toBe("batch-ingredient-1");
    expect(batches[0].itemKind).toBe("ingredient");
    expect(batches[0].totalQtyDelta).toBe(2);
    expect(batches[0].lines).toHaveLength(2);
  });
});


describe("adjustment valuation", () => {
  const base = {
    reference_type: "inventory_adjustment",
    note: null,
    occurred_at: "2026-11-09T07:00:00.000Z",
    item_kind: "ingredient" as const,
    product_id: null,
    variant_id: null,
  };

  it("values a stock decrease as expense (Ayam Broiler −10 kg × Rp38.000)", () => {
    const [batch] = groupAdjustmentMovements([
      { ...base, id: "m1", reference_id: "b1", ingredient_id: "ayam", qty_delta: -10, qty_after: 5, unit_cost: 38000 },
    ]);
    expect(batch.totalExpense).toBe(380000);
    expect(batch.totalIncome).toBe(0);
    expect(batch.hasMissingCost).toBe(false);
    expect(batch.lines[0].value).toBe(-380000);
    expect(batch.lines[0].unitCost).toBe(38000);
  });

  it("values a stock increase as income and keeps items without a buy price apart", () => {
    const batches = groupAdjustmentMovements([
      { ...base, id: "m1", reference_id: "b1", ingredient_id: "bumbu", qty_delta: 1.5, qty_after: 3, unit_cost: 20000 },
      { ...base, id: "m2", reference_id: "b1", ingredient_id: "kecap", qty_delta: -2, qty_after: 1, unit_cost: null },
      { ...base, id: "m3", reference_id: "b2", ingredient_id: "ayam", qty_delta: -0.25, qty_after: 1, unit_cost: 38000 },
    ]);
    const b1 = batches.find((b) => b.referenceId === "b1")!;
    expect(b1.totalIncome).toBe(30000);
    expect(b1.totalExpense).toBe(0);
    expect(b1.hasMissingCost).toBe(true);
    expect(b1.lines.find((l) => l.itemKind === "ingredient" && l.ingredientId === "kecap")!.value).toBeNull();

    expect(summarizeAdjustmentBatches(batches)).toEqual({
      totalAdjustmentExpense: 9500,
      totalAdjustmentIncome: 30000,
      itemsWithoutCost: 1,
    });
  });

  it("treats a zero or missing unit cost as no buy price", () => {
    expect(adjustmentMovementValue(-3, 0)).toBeNull();
    expect(adjustmentMovementValue(-3, undefined)).toBeNull();
    expect(adjustmentMovementValue(0, 5000)).toBe(0);
  });

  it("formats signed rupiah", () => {
    expect(formatSignedRupiah(-380000)).toBe("−Rp380.000");
    expect(formatSignedRupiah(12000)).toBe("+Rp12.000");
    expect(formatSignedRupiah(0)).toBe("Rp0");
  });
});
