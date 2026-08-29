import { describe, expect, it } from "vitest";
import {
  buildDiscountSalesDisplay,
  discountRowKey,
  normalizeDiscountSalesDiscountRow,
  normalizeDiscountSalesValueRow,
  parentValueLabel,
  sortDiscountSalesDiscounts,
} from "./computeDiscountSalesDisplay";

describe("normalizeDiscountSalesDiscountRow", () => {
  it("maps RPC fields to display row", () => {
    const row = normalizeDiscountSalesDiscountRow(
      {
        catalog_discount_id: "d1",
        discount_name: "Diskon Karyawan",
        sort_order: 2,
        times_applied: 10,
        gross_discount: 183600,
        refund_amount: 0,
        net_discount: 183600,
      },
      "Unknown",
    );
    expect(row.discountName).toBe("Diskon Karyawan");
    expect(row.timesApplied).toBe(10);
    expect(row.netDiscount).toBe(183600);
  });
});

describe("buildDiscountSalesDisplay", () => {
  it("builds parent-child display rows", () => {
    const display = buildDiscountSalesDisplay({
      discountRowsRaw: [
        {
          catalog_discount_id: "d1",
          discount_name: "Compliment",
          sort_order: 1,
          times_applied: 1,
          gross_discount: 91000,
          refund_amount: 0,
          net_discount: 91000,
          summary_total_net_discount: 91000,
        },
      ],
      valueRowsRaw: [
        {
          catalog_discount_id: "d1",
          discount_name: "Compliment",
          discount_sort_order: 1,
          value_label: "100%",
          value_sort_order: 100,
          times_applied: 1,
          gross_discount: 91000,
          refund_amount: 0,
          net_discount: 91000,
        },
      ],
      unknownDiscountLabel: "Unknown",
    });

    expect(display.discounts).toHaveLength(1);
    expect(display.values).toHaveLength(1);
    expect(display.displayRows).toHaveLength(2);
    expect(display.grandTotal.netDiscount).toBe(91000);
    expect(display.summaryTotalNetDiscount).toBe(91000);
  });

  it("returns empty display when no data", () => {
    const display = buildDiscountSalesDisplay({
      discountRowsRaw: [],
      valueRowsRaw: [],
      unknownDiscountLabel: "Unknown",
    });
    expect(display.discounts).toHaveLength(0);
    expect(display.grandTotal.timesApplied).toBe(0);
  });
});

describe("sortDiscountSalesDiscounts", () => {
  it("sorts by gross discount desc", () => {
    const sorted = sortDiscountSalesDiscounts(
      [
        {
          catalogDiscountId: "a",
          discountName: "A",
          sortOrder: 1,
          timesApplied: 1,
          grossDiscount: 100,
          refundAmount: 0,
          netDiscount: 100,
        },
        {
          catalogDiscountId: "b",
          discountName: "B",
          sortOrder: 2,
          timesApplied: 1,
          grossDiscount: 500,
          refundAmount: 0,
          netDiscount: 500,
        },
      ],
      "grossDiscount",
      "desc",
    );
    expect(sorted[0].discountName).toBe("B");
  });
});

describe("discountRowKey", () => {
  it("combines id and name", () => {
    expect(discountRowKey("id1", "Test")).toBe("id1::Test");
    expect(discountRowKey(null, "Manual")).toBe("__unknown__::Manual");
  });
});

describe("parentValueLabel", () => {
  it("shows single child value on parent", () => {
    const discount = normalizeDiscountSalesDiscountRow(
      { catalog_discount_id: "d1", discount_name: "Compliment" },
      "Unknown",
    );
    const values = [
      normalizeDiscountSalesValueRow(
        { catalog_discount_id: "d1", discount_name: "Compliment", value_label: "100%" },
        "Unknown",
      ),
    ];
    expect(parentValueLabel(discount, values)).toBe("100%");
  });

  it("shows dash when multiple children", () => {
    const discount = normalizeDiscountSalesDiscountRow(
      { catalog_discount_id: "d1", discount_name: "Mix" },
      "Unknown",
    );
    const values = [
      normalizeDiscountSalesValueRow(
        { catalog_discount_id: "d1", discount_name: "Mix", value_label: "10%" },
        "Unknown",
      ),
      normalizeDiscountSalesValueRow(
        { catalog_discount_id: "d1", discount_name: "Mix", value_label: "20%" },
        "Unknown",
      ),
    ];
    expect(parentValueLabel(discount, values)).toBe("—");
  });
});
