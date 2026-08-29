import { describe, expect, it } from "vitest";
import {
  buildGrossProfitItemsFooterState,
  computeItemTotalsMarginPct,
  sumGrossProfitItemRows,
} from "./computeGrossProfitItemsTotals";
import type { GrossProfitItemRow } from "./grossProfitItemTypes";

const ITEM: GrossProfitItemRow = {
  catalogProductId: null,
  catalogVariantId: null,
  productName: "Unlinked",
  variantName: null,
  categoryId: null,
  categoryName: null,
  qty: 71,
  netSales: 1020516,
  cogs: 0,
  grossProfit: 1020516,
  marginPct: 100,
  cogsIncomplete: true,
  cogsEstimated: false,
};

describe("sumGrossProfitItemRows", () => {
  it("sums qty and derives aggregate margin from totals", () => {
    const totals = sumGrossProfitItemRows([
      ITEM,
      { ...ITEM, qty: 10, netSales: 200000, cogs: 50000, grossProfit: 150000, marginPct: 75 },
    ]);
    expect(totals.qty).toBe(81);
    expect(totals.netSales).toBe(1220516);
    expect(totals.marginPct).toBe(
      computeItemTotalsMarginPct({ netSales: totals.netSales, grossProfit: totals.grossProfit }),
    );
  });
});

describe("buildGrossProfitItemsFooterState", () => {
  it("reconciles product total + non-product with summary net", () => {
    const footer = buildGrossProfitItemsFooterState({
      items: [ITEM],
      metrics: {
        netSales: 1420516,
        productNetSales: 1020516,
        nonProductNet: 400000,
      },
    });
    expect(footer.itemTotals.netSales).toBe(1020516);
    expect(footer.matchesSummary).toBe(true);
    expect(footer.showNonProductRow).toBe(true);
  });

  it("flags mismatch when non-product missing from metrics", () => {
    const footer = buildGrossProfitItemsFooterState({
      items: [ITEM],
      metrics: {
        netSales: 1420516,
        productNetSales: 1020516,
        nonProductNet: 0,
      },
    });
    expect(footer.matchesSummary).toBe(false);
  });
});
