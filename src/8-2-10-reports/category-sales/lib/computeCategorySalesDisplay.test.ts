import { describe, expect, it } from "vitest";
import {
  buildCategorySalesDisplay,
  normalizeCategorySalesRow,
  sortCategorySalesRows,
} from "./computeCategorySalesDisplay";

describe("normalizeCategorySalesRow", () => {
  it("maps RPC row fields and computes gross profit fallback", () => {
    const row = normalizeCategorySalesRow(
      {
        category_id: "cat-1",
        category_name: "Beverages",
        sort_order: 10,
        qty_sold: 5,
        qty_refunded: 1,
        gross_sales: 100000,
        net_sales: 90000,
        discount_amount: 10000,
        refund_amount: 5000,
        cogs: 30000,
        cogs_incomplete: true,
      },
      "Uncategorized",
    );
    expect(row.categoryName).toBe("Beverages");
    expect(row.grossProfit).toBe(60000);
    expect(row.cogsIncomplete).toBe(true);
  });

  it("uses uncategorized label when category name is empty", () => {
    const row = normalizeCategorySalesRow({ category_id: null, category_name: "" }, "Uncategorized");
    expect(row.categoryName).toBe("Uncategorized");
  });
});

describe("buildCategorySalesDisplay", () => {
  it("aggregates grand total and flags reconciliation match", () => {
    const display = buildCategorySalesDisplay(
      [
        {
          category_id: "a",
          category_name: "Food",
          qty_sold: 2,
          gross_sales: 50000,
          net_sales: 45000,
          discount_amount: 5000,
          summary_product_net_sales: 45000,
        },
      ],
      "Uncategorized",
    );
    expect(display.grandTotal.netSales).toBe(45000);
    expect(display.reconciliationOk).toBe(true);
  });

  it("flags reconciliation mismatch beyond epsilon", () => {
    const display = buildCategorySalesDisplay(
      [
        {
          category_id: "a",
          category_name: "Food",
          net_sales: 100,
          summary_product_net_sales: 200,
        },
      ],
      "Uncategorized",
    );
    expect(display.reconciliationOk).toBe(false);
  });

  it("detects incomplete COGS across rows", () => {
    const display = buildCategorySalesDisplay(
      [
        { category_name: "A", cogs_incomplete: false },
        { category_name: "B", cogs_incomplete: true },
      ],
      "Uncategorized",
    );
    expect(display.hasCogsIncomplete).toBe(true);
  });
});

describe("sortCategorySalesRows", () => {
  it("sorts by gross sales descending by default pattern", () => {
    const rows = sortCategorySalesRows(
      [
        {
          categoryId: "a",
          categoryName: "A",
          sortOrder: 1,
          qtySold: 1,
          qtyRefunded: 0,
          grossSales: 50,
          netSales: 40,
          discountAmount: 10,
          refundAmount: 0,
          cogs: 20,
          grossProfit: 20,
          marginPct: 50,
          cogsIncomplete: false,
          cogsEstimated: false,
        },
        {
          categoryId: "b",
          categoryName: "B",
          sortOrder: 2,
          qtySold: 2,
          qtyRefunded: 0,
          grossSales: 100,
          netSales: 90,
          discountAmount: 10,
          refundAmount: 0,
          cogs: 30,
          grossProfit: 60,
          marginPct: 66.67,
          cogsIncomplete: false,
          cogsEstimated: false,
        },
      ],
      "grossSales",
      "desc",
    );
    expect(rows[0].categoryId).toBe("b");
  });
});
