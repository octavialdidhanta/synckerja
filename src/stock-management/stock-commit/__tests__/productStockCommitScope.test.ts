import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { filterLinesForPayStock } from "../lib/productStockCommitScope";
import { cartLineCommitFingerprint } from "../lib/computeCommitDelta";
import type { PosSessionStockCommit } from "../types/sessionStockCommit";

function line(partial: Partial<CustomerVisitCartLine> & { catalogId: string }): CustomerVisitCartLine {
  return {
    lineKey: partial.lineKey ?? partial.catalogId,
    catalogId: partial.catalogId,
    kind: "product",
    serviceId: null,
    subServiceId: null,
    serviceName: "Item",
    subServiceName: null,
    quantity: partial.quantity ?? 1,
    unitPrice: 10000,
    trackStock: partial.trackStock ?? false,
    inventorySkuId: null,
    availableQty: null,
    ...partial,
  };
}

describe("filterLinesForPayStock", () => {
  it("returns all lines for pay mode", () => {
    const lines = [line({ catalogId: "p1" }), line({ catalogId: "p2" })];
    expect(filterLinesForPayStock({ lines, commitPoint: "pay", commits: [] })).toHaveLength(2);
  });

  it("skips kitchen-committed recipe lines in kitchen mode", () => {
    const l = line({ catalogId: "p1", trackStock: false });
    const fp = cartLineCommitFingerprint(l);
    const commits: PosSessionStockCommit[] = [
      {
        id: "1",
        organization_id: "o",
        outlet_id: "out",
        session_id: "s",
        line_fingerprint: fp,
        line_index: 1,
        committed_qty: 1,
        last_reference_id: "r",
        last_committed_at: "",
        created_at: "",
        updated_at: "",
      },
    ];
    const result = filterLinesForPayStock({
      lines: [l],
      commitPoint: "kitchen",
      commits,
      hasBaseRecipeSet: new Set(["p1"]),
    });
    expect(result).toHaveLength(0);
  });

  it("includes uncommitted recipe qty at pay in kitchen mode", () => {
    const l = line({ catalogId: "p1", quantity: 3, trackStock: false });
    const fp = cartLineCommitFingerprint(l);
    const result = filterLinesForPayStock({
      lines: [l],
      commitPoint: "kitchen",
      commits: [
        {
          id: "1",
          organization_id: "o",
          outlet_id: "out",
          session_id: "s",
          line_fingerprint: fp,
          line_index: 1,
          committed_qty: 2,
          last_reference_id: "r",
          last_committed_at: "",
          created_at: "",
          updated_at: "",
        },
      ],
      hasBaseRecipeSet: new Set(["p1"]),
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(1);
  });

  it("includes retail tracked lines on pay in kitchen mode", () => {
    const l = line({ catalogId: "p1", trackStock: true, inventorySkuId: "sku1" });
    const result = filterLinesForPayStock({
      lines: [l],
      commitPoint: "kitchen",
      commits: [],
    });
    expect(result).toHaveLength(1);
  });
});

describe("shouldDeductOnPay", () => {
  it("always deducts in pay mode", async () => {
    const { shouldDeductOnPay } = await import("../lib/shouldDeductOnPay");
    expect(shouldDeductOnPay({ commitPoint: "pay", hasUncommittedPayLines: false })).toBe(true);
  });
});
