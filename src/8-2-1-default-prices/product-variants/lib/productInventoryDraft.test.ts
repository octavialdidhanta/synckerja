import { describe, expect, it } from "vitest";
import { draftToOutletStock, outletQtyForTable, parseStockQty } from "./productInventoryDraft";

describe("parseStockQty", () => {
  it("parses non-negative numbers", () => {
    expect(parseStockQty("500")).toBe(500);
    expect(parseStockQty("-1")).toBe(0);
    expect(parseStockQty("")).toBe(0);
  });
});

describe("draftToOutletStock", () => {
  it("zeros stock when tracking is off", () => {
    expect(
      draftToOutletStock(
        { variantId: null, trackStock: false, inStock: "10", alertEnabled: true, alertAt: "2" },
        { variantId: null, trackCogs: true, avgCost: "100" },
        false,
      ),
    ).toEqual({
      in_stock: 0,
      alert_enabled: false,
      alert_at: null,
      track_cogs: false,
      avg_cost: 0,
    });
  });
});

describe("outletQtyForTable", () => {
  it("sums variant stock for the outlet", () => {
    expect(
      outletQtyForTable({
        trackStock: true,
        outletId: "o1",
        variants: [{ id: "v1", name: "A", sku: null, price: 1, sort_order: 1 }],
        variantStocks: [
          {
            variant_id: "v1",
            outlet_id: "o1",
            in_stock: 3,
            alert_enabled: false,
            alert_at: null,
            track_cogs: false,
            avg_cost: 0,
          },
        ],
      }),
    ).toBe(3);
  });
});
