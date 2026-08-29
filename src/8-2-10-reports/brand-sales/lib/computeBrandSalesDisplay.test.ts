import { describe, expect, it } from "vitest";
import {
  buildBrandSalesDisplay,
  formatBrandItemDisplayName,
  normalizeBrandSalesBrandRow,
  rebuildDisplayRows,
  sortBrandSalesBrands,
} from "./computeBrandSalesDisplay";

describe("normalizeBrandSalesBrandRow", () => {
  it("maps RPC fields and fallback gross profit", () => {
    const row = normalizeBrandSalesBrandRow(
      {
        brand_id: "b1",
        brand_name: "Adalah Kopi",
        sort_order: 10,
        qty_sold: 54,
        net_sales: 1000000,
        cogs: 400000,
        cogs_incomplete: true,
      },
      "Unbranded",
    );
    expect(row.brandName).toBe("Adalah Kopi");
    expect(row.grossProfit).toBe(600000);
    expect(row.cogsIncomplete).toBe(true);
  });
});

describe("buildBrandSalesDisplay", () => {
  it("builds hierarchical display rows brand then items", () => {
    const display = buildBrandSalesDisplay({
      brandRowsRaw: [
        {
          brand_id: "b1",
          brand_name: "Adalah Kopi",
          sort_order: 10,
          gross_sales: 100000,
          net_sales: 90000,
          summary_product_net_sales: 90000,
        },
      ],
      itemRowsRaw: [
        {
          brand_id: "b1",
          brand_name: "Adalah Kopi",
          item_name: "Cafe Mocha",
          variant_name: "Hot",
          net_sales: 50000,
        },
        {
          brand_id: "b1",
          brand_name: "Adalah Kopi",
          item_name: "Cafe Mocha",
          variant_name: "Ice",
          net_sales: 40000,
        },
      ],
      unbrandedLabel: "Unbranded",
    });

    expect(display.displayRows).toHaveLength(3);
    expect(display.displayRows[0].rowKind).toBe("brand");
    expect(display.displayRows[1].rowKind).toBe("item");
    expect(display.displayRows[2].rowKind).toBe("item");
    expect(display.reconciliationOk).toBe(true);
  });

  it("flags reconciliation mismatch", () => {
    const display = buildBrandSalesDisplay({
      brandRowsRaw: [{ brand_name: "A", net_sales: 100, summary_product_net_sales: 200 }],
      itemRowsRaw: [],
      unbrandedLabel: "Unbranded",
    });
    expect(display.reconciliationOk).toBe(false);
  });
});

describe("sortBrandSalesBrands", () => {
  it("sorts brands by gross sales desc", () => {
    const sorted = sortBrandSalesBrands(
      [
        {
          brandId: "a",
          brandName: "A",
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
          brandId: "b",
          brandName: "B",
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
    expect(sorted[0].brandId).toBe("b");
  });
});

describe("formatBrandItemDisplayName", () => {
  it("joins item and variant", () => {
    expect(
      formatBrandItemDisplayName({ itemName: "Cafe Mocha", variantName: "Hot" }),
    ).toBe("Cafe Mocha - Hot");
  });
});

describe("rebuildDisplayRows", () => {
  it("preserves item order under sorted brands", () => {
    const brands = sortBrandSalesBrands(
      [
        {
          brandId: "b",
          brandName: "B",
          sortOrder: 2,
          qtySold: 1,
          qtyRefunded: 0,
          grossSales: 100,
          netSales: 90,
          discountAmount: 10,
          refundAmount: 0,
          cogs: 30,
          grossProfit: 60,
          marginPct: 66,
          cogsIncomplete: false,
          cogsEstimated: false,
        },
      ],
      "grossSales",
      "desc",
    );
    const items = [
      {
        brandId: "b",
        brandName: "B",
        brandSortOrder: 2,
        catalogProductId: "p1",
        catalogVariantId: null,
        catalogBundleId: null,
        itemName: "Item",
        variantName: null,
        sku: null,
        qtySold: 1,
        qtyRefunded: 0,
        grossSales: 100,
        netSales: 90,
        discountAmount: 10,
        refundAmount: 0,
        cogs: 30,
        grossProfit: 60,
        marginPct: 66,
        cogsIncomplete: false,
        cogsEstimated: false,
      },
    ];
    const rows = rebuildDisplayRows(brands, items);
    expect(rows[0].rowKind).toBe("brand");
    expect(rows[1].rowKind).toBe("item");
  });
});
