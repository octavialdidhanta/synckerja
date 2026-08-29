import { describe, expect, it } from "vitest";
import {
  buildItemSalesDisplay,
  filterItemSalesBySearch,
  formatItemDisplayName,
  isItemSalesBundleRow,
  normalizeItemSalesRow,
  resolveQtyAlaCarte,
  resolveQtyBundle,
  sortItemSalesIncomeRows,
  sortItemSalesQuantityRows,
} from "./computeItemSalesDisplay";

describe("normalizeItemSalesRow", () => {
  it("maps RPC fields and computes margin when missing", () => {
    const row = normalizeItemSalesRow({
      catalog_product_id: "p1",
      catalog_variant_id: "v1",
      item_name: "Nike",
      variant_name: "39",
      sku: "NK-39",
      category_name: "Shoes",
      qty_sold: 10,
      qty_refunded: 2,
      gross_sales: 1200000,
      net_sales: 1000000,
      cogs: 400000,
    });
    expect(row.itemName).toBe("Nike");
    expect(row.variantName).toBe("39");
    expect(row.grossProfit).toBe(600000);
    expect(row.marginPct).toBe(60);
  });
});

describe("buildItemSalesDisplay", () => {
  it("aggregates totals and flags reconciliation mismatch", () => {
    const display = buildItemSalesDisplay([
      {
        catalog_product_id: "p1",
        item_name: "A",
        qty_sold: 5,
        qty_refunded: 1,
        gross_sales: 500,
        net_sales: 400,
        cogs: 100,
        gross_profit: 300,
        margin_pct: 75,
        summary_product_net_sales: 400,
      },
      {
        catalog_product_id: "p2",
        item_name: "B",
        qty_sold: 3,
        qty_refunded: 0,
        gross_sales: 300,
        net_sales: 200,
        cogs: 50,
        gross_profit: 150,
        margin_pct: 75,
        summary_product_net_sales: 400,
      },
    ]);
    expect(display.totals.netSales).toBe(600);
    expect(display.totals.qtySold).toBe(8);
    expect(display.totals.qtyRefunded).toBe(1);
    expect(display.reconciliationOk).toBe(false);
  });

  it("passes reconciliation when totals match summary", () => {
    const display = buildItemSalesDisplay([
      {
        item_name: "A",
        net_sales: 500,
        summary_product_net_sales: 500,
      },
    ]);
    expect(display.reconciliationOk).toBe(true);
  });
});

describe("filterItemSalesBySearch", () => {
  it("filters by name, variant, or sku", () => {
    const rows = [
      normalizeItemSalesRow({ item_name: "Latte", sku: "LAT-01" }),
      normalizeItemSalesRow({ item_name: "Espresso", sku: "ESP-01" }),
    ];
    expect(filterItemSalesBySearch(rows, "lat").length).toBe(1);
    expect(filterItemSalesBySearch(rows, "esp-01").length).toBe(1);
  });
});

describe("sortItemSalesIncomeRows", () => {
  it("sorts by net sales descending by default pattern", () => {
    const rows = [
      normalizeItemSalesRow({ item_name: "Low", net_sales: 100 }),
      normalizeItemSalesRow({ item_name: "High", net_sales: 500 }),
    ];
    const sorted = sortItemSalesIncomeRows(rows, "netSales", "desc");
    expect(sorted[0]?.itemName).toBe("High");
  });
});

describe("resolveQtyAlaCarte / resolveQtyBundle", () => {
  it("splits product vs bundle rows", () => {
    const product = normalizeItemSalesRow({
      catalog_product_id: "p1",
      item_name: "Latte",
      qty_sold: 5,
    });
    const bundle = normalizeItemSalesRow({
      catalog_bundle_id: "b1",
      item_name: "Combo",
      qty_sold: 3,
    });
    expect(resolveQtyAlaCarte(product)).toBe(5);
    expect(resolveQtyBundle(product)).toBe(0);
    expect(resolveQtyAlaCarte(bundle)).toBe(0);
    expect(resolveQtyBundle(bundle)).toBe(3);
    expect(isItemSalesBundleRow(bundle)).toBe(true);
  });
});

describe("sortItemSalesQuantityRows", () => {
  it("sorts by a la carte qty", () => {
    const rows = [
      normalizeItemSalesRow({ catalog_product_id: "p1", item_name: "A", qty_sold: 2 }),
      normalizeItemSalesRow({ catalog_product_id: "p2", item_name: "B", qty_sold: 10 }),
    ];
    const sorted = sortItemSalesQuantityRows(rows, "qtyAlaCarte", "desc");
    expect(sorted[0]?.itemName).toBe("B");
  });
});

describe("formatItemDisplayName", () => {
  it("joins variant when present", () => {
    expect(formatItemDisplayName({ itemName: "Nike", variantName: "39" })).toBe("Nike - 39");
    expect(formatItemDisplayName({ itemName: "Nike", variantName: null })).toBe("Nike");
  });
});
