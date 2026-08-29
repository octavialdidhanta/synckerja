import { describe, expect, it } from "vitest";
import {
  buildGratuitySalesDisplay,
  gratuityRowKey,
  normalizeGratuitySalesGratuityRow,
  normalizeGratuitySalesRateRow,
  parentRateLabel,
  sortGratuitySalesGratuities,
} from "./computeGratuitySalesDisplay";

describe("normalizeGratuitySalesGratuityRow", () => {
  it("maps RPC fields to display row", () => {
    const row = normalizeGratuitySalesGratuityRow(
      {
        catalog_gratuity_id: "g1",
        gratuity_name: "Service Charge",
        sort_order: 1,
        times_applied: 42,
        gratuity_collected: 394801,
        gross_gratuity: 394801,
        refund_amount: 0,
        net_gratuity: 394801,
      },
      "Unknown",
    );
    expect(row.gratuityName).toBe("Service Charge");
    expect(row.gratuityCollected).toBe(394801);
    expect(row.netGratuity).toBe(394801);
  });
});

describe("buildGratuitySalesDisplay", () => {
  it("builds parent-child display rows", () => {
    const display = buildGratuitySalesDisplay({
      gratuityRowsRaw: [
        {
          catalog_gratuity_id: "g1",
          gratuity_name: "Service Charge",
          sort_order: 1,
          times_applied: 10,
          gratuity_collected: 50000,
          refund_amount: 0,
          net_gratuity: 50000,
          summary_total_net_gratuity: 50000,
        },
      ],
      rateRowsRaw: [
        {
          catalog_gratuity_id: "g1",
          gratuity_name: "Service Charge",
          gratuity_sort_order: 1,
          rate_label: "5%",
          rate_sort_order: 5,
          times_applied: 10,
          gratuity_collected: 50000,
          refund_amount: 0,
          net_gratuity: 50000,
        },
      ],
      unknownGratuityLabel: "Unknown",
    });

    expect(display.gratuities).toHaveLength(1);
    expect(display.rates).toHaveLength(1);
    expect(display.displayRows).toHaveLength(2);
    expect(display.grandTotal.gratuityCollected).toBe(50000);
    expect(display.summaryTotalNetGratuity).toBe(50000);
  });

  it("returns empty display when no data", () => {
    const display = buildGratuitySalesDisplay({
      gratuityRowsRaw: [],
      rateRowsRaw: [],
      unknownGratuityLabel: "Unknown",
    });
    expect(display.gratuities).toHaveLength(0);
    expect(display.grandTotal.gratuityCollected).toBe(0);
  });

  it("flags backfill estimate from RPC", () => {
    const display = buildGratuitySalesDisplay({
      gratuityRowsRaw: [
        {
          gratuity_name: "Legacy",
          gratuity_collected: 10000,
          has_backfill_estimate: true,
        },
      ],
      rateRowsRaw: [],
      unknownGratuityLabel: "Unknown",
    });
    expect(display.hasBackfillEstimate).toBe(true);
  });
});

describe("sortGratuitySalesGratuities", () => {
  it("sorts by gratuity collected desc", () => {
    const sorted = sortGratuitySalesGratuities(
      [
        {
          catalogGratuityId: "a",
          gratuityName: "A",
          sortOrder: 1,
          gratuityCollected: 100,
          timesApplied: 1,
          refundAmount: 0,
          netGratuity: 100,
          hasBackfillEstimate: false,
        },
        {
          catalogGratuityId: "b",
          gratuityName: "B",
          sortOrder: 2,
          gratuityCollected: 500,
          timesApplied: 1,
          refundAmount: 0,
          netGratuity: 500,
          hasBackfillEstimate: false,
        },
      ],
      "gratuityCollected",
      "desc",
    );
    expect(sorted[0].gratuityName).toBe("B");
  });
});

describe("gratuityRowKey", () => {
  it("combines id and name", () => {
    expect(gratuityRowKey("id1", "Service")).toBe("id1::Service");
    expect(gratuityRowKey(null, "Legacy")).toBe("__unknown__::Legacy");
  });
});

describe("parentRateLabel", () => {
  it("shows single child rate on parent", () => {
    const gratuity = normalizeGratuitySalesGratuityRow(
      { catalog_gratuity_id: "g1", gratuity_name: "Service Charge" },
      "Unknown",
    );
    const rates = [
      normalizeGratuitySalesRateRow(
        { catalog_gratuity_id: "g1", gratuity_name: "Service Charge", rate_label: "5%" },
        "Unknown",
      ),
    ];
    expect(parentRateLabel(gratuity, rates)).toBe("5%");
  });
});
