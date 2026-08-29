import { describe, expect, it } from "vitest";
import {
  buildTaxSalesDisplay,
  normalizeTaxSalesRateRow,
  normalizeTaxSalesTaxRow,
  parentRateLabel,
  sortTaxSalesTaxes,
  taxRowKey,
} from "./computeTaxSalesDisplay";

describe("normalizeTaxSalesTaxRow", () => {
  it("maps RPC fields to Moka display row", () => {
    const row = normalizeTaxSalesTaxRow(
      {
        catalog_tax_id: "t1",
        tax_name: "PB1",
        sort_order: 1,
        times_applied: 42,
        taxable_amount: 1250000,
        tax_collected: 125000,
        gross_tax: 125000,
        refund_amount: 0,
        net_tax: 125000,
        has_backfill_estimate: false,
      },
      "Unknown",
    );
    expect(row.taxName).toBe("PB1");
    expect(row.taxableAmount).toBe(1250000);
    expect(row.taxCollected).toBe(125000);
    expect(row.netTax).toBe(125000);
  });

  it("falls back gross_tax when tax_collected missing", () => {
    const row = normalizeTaxSalesTaxRow(
      {
        tax_name: "PPN",
        gross_tax: 55000,
        taxable_amount: 500000,
      },
      "Unknown",
    );
    expect(row.taxCollected).toBe(55000);
    expect(row.taxableAmount).toBe(500000);
  });
});

describe("buildTaxSalesDisplay", () => {
  it("builds parent-child display rows with Moka metrics", () => {
    const display = buildTaxSalesDisplay({
      taxRowsRaw: [
        {
          catalog_tax_id: "t1",
          tax_name: "PPN",
          sort_order: 1,
          times_applied: 10,
          taxable_amount: 1000000,
          tax_collected: 110000,
          gross_tax: 110000,
          refund_amount: 0,
          net_tax: 110000,
          summary_total_net_tax: 110000,
        },
      ],
      rateRowsRaw: [
        {
          catalog_tax_id: "t1",
          tax_name: "PPN",
          tax_sort_order: 1,
          rate_label: "11%",
          rate_sort_order: 11,
          times_applied: 10,
          taxable_amount: 1000000,
          tax_collected: 110000,
          gross_tax: 110000,
          refund_amount: 0,
          net_tax: 110000,
        },
      ],
      unknownTaxLabel: "Unknown",
    });

    expect(display.taxes).toHaveLength(1);
    expect(display.rates).toHaveLength(1);
    expect(display.displayRows).toHaveLength(2);
    expect(display.grandTotal.taxCollected).toBe(110000);
    expect(display.grandTotal.taxableAmount).toBe(1000000);
    expect(display.summaryTotalNetTax).toBe(110000);
  });

  it("returns empty display when no data", () => {
    const display = buildTaxSalesDisplay({
      taxRowsRaw: [],
      rateRowsRaw: [],
      unknownTaxLabel: "Unknown",
    });
    expect(display.taxes).toHaveLength(0);
    expect(display.grandTotal.taxCollected).toBe(0);
  });

  it("flags backfill estimate from RPC", () => {
    const display = buildTaxSalesDisplay({
      taxRowsRaw: [
        {
          tax_name: "Legacy",
          tax_collected: 10000,
          taxable_amount: 100000,
          has_backfill_estimate: true,
        },
      ],
      rateRowsRaw: [],
      unknownTaxLabel: "Unknown",
    });
    expect(display.hasBackfillEstimate).toBe(true);
  });
});

describe("sortTaxSalesTaxes", () => {
  it("sorts by tax collected desc", () => {
    const sorted = sortTaxSalesTaxes(
      [
        {
          catalogTaxId: "a",
          taxName: "A",
          sortOrder: 1,
          taxableAmount: 100000,
          taxCollected: 100,
          timesApplied: 1,
          refundAmount: 0,
          netTax: 100,
          netTaxableAmount: 100000,
          hasBackfillEstimate: false,
        },
        {
          catalogTaxId: "b",
          taxName: "B",
          sortOrder: 2,
          taxableAmount: 500000,
          taxCollected: 500,
          timesApplied: 1,
          refundAmount: 0,
          netTax: 500,
          netTaxableAmount: 500000,
          hasBackfillEstimate: false,
        },
      ],
      "taxCollected",
      "desc",
    );
    expect(sorted[0].taxName).toBe("B");
  });
});

describe("taxRowKey", () => {
  it("combines id and name", () => {
    expect(taxRowKey("id1", "PPN")).toBe("id1::PPN");
    expect(taxRowKey(null, "Legacy")).toBe("__unknown__::Legacy");
  });
});

describe("parentRateLabel", () => {
  it("shows single child rate on parent", () => {
    const tax = normalizeTaxSalesTaxRow(
      { catalog_tax_id: "t1", tax_name: "PB1" },
      "Unknown",
    );
    const rates = [
      normalizeTaxSalesRateRow(
        { catalog_tax_id: "t1", tax_name: "PB1", rate_label: "10%" },
        "Unknown",
      ),
    ];
    expect(parentRateLabel(tax, rates)).toBe("10%");
  });

  it("shows dash when multiple children", () => {
    const tax = normalizeTaxSalesTaxRow(
      { catalog_tax_id: "t1", tax_name: "PB1" },
      "Unknown",
    );
    const rates = [
      normalizeTaxSalesRateRow(
        { catalog_tax_id: "t1", tax_name: "PB1", rate_label: "10%" },
        "Unknown",
      ),
      normalizeTaxSalesRateRow(
        { catalog_tax_id: "t1", tax_name: "PB1", rate_label: "11%" },
        "Unknown",
      ),
    ];
    expect(parentRateLabel(tax, rates)).toBe("—");
  });
});
