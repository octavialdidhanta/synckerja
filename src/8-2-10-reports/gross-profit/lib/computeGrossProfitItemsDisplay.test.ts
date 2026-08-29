import { describe, expect, it } from "vitest";
import {
  filterGrossProfitItemsBySearch,
  normalizeGrossProfitItemRow,
} from "./computeGrossProfitItemsDisplay";

describe("normalizeGrossProfitItemRow", () => {
  it("maps RPC fields and flags", () => {
    const row = normalizeGrossProfitItemRow({
      catalog_product_id: "p1",
      catalog_variant_id: "v1",
      product_name: "Americano",
      variant_name: "Large",
      qty: 3,
      net_sales: 90000,
      cogs: 30000,
      gross_profit: 60000,
      margin_pct: 66.67,
      cogs_incomplete: false,
      cogs_estimated: true,
    });
    expect(row.productName).toBe("Americano");
    expect(row.variantName).toBe("Large");
    expect(row.grossProfit).toBe(60000);
    expect(row.cogsEstimated).toBe(true);
  });

  it("derives margin 0 when net sales is 0", () => {
    const row = normalizeGrossProfitItemRow({
      product_name: "X",
      net_sales: 0,
      cogs: 0,
    });
    expect(row.marginPct).toBe(0);
    expect(row.grossProfit).toBe(0);
  });

  it("maps category fields", () => {
    const row = normalizeGrossProfitItemRow({
      product_name: "Americano",
      category_id: "c1",
      category_name: "Drinks",
      net_sales: 1,
    });
    expect(row.categoryId).toBe("c1");
    expect(row.categoryName).toBe("Drinks");
  });

  it("falls back product name to Unlinked", () => {
    expect(normalizeGrossProfitItemRow({}).productName).toBe("Unlinked");
  });
});

describe("filterGrossProfitItemsBySearch", () => {
  it("matches product or variant name", () => {
    const rows = [
      normalizeGrossProfitItemRow({
        product_name: "Americano",
        variant_name: "Large",
        net_sales: 1,
      }),
      normalizeGrossProfitItemRow({
        product_name: "Latte",
        net_sales: 1,
      }),
    ];
    expect(filterGrossProfitItemsBySearch(rows, "large")).toHaveLength(1);
    expect(filterGrossProfitItemsBySearch(rows, "lat")).toHaveLength(1);
  });
});
