import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { computePayStockDelta } from "../../lib/pay/computePayStockDelta";
import { cartLineCommitFingerprint } from "../../lib/computeCommitDelta";
import type { PosSessionStockCommit } from "../../types/sessionStockCommit";

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
    trackStock: false,
    inventorySkuId: null,
    availableQty: null,
    ...partial,
  };
}

describe("split pay uncommitted harden", () => {
  it("split portion of uncommitted qty only", () => {
    const full = line({ catalogId: "burger", quantity: 3 });
    const fp = cartLineCommitFingerprint(full);
    const commits: PosSessionStockCommit[] = [
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
    ];
    // Split pays 1 of remaining cart (same fingerprint, qty 1 as portion)
    const splitPortion = line({ catalogId: "burger", quantity: 1 });
    const result = computePayStockDelta({
      lines: [splitPortion],
      commitPoint: "kitchen",
      commits,
      hasBaseRecipeSet: new Set(["burger"]),
    });
    // committed 2, cart portion 1 → uncommitted = max(0, 1-2) = 0
    // Note: split of already-committed qty should skip; split of remaining needs remainder lines
    expect(result).toHaveLength(0);
  });

  it("split pays remaining uncommitted when portion qty exceeds committed on that fingerprint", () => {
    const portion = line({ catalogId: "burger", quantity: 3 });
    const result = computePayStockDelta({
      lines: [portion],
      commitPoint: "kitchen",
      commits: [
        {
          id: "1",
          organization_id: "o",
          outlet_id: "out",
          session_id: "s",
          line_fingerprint: cartLineCommitFingerprint(portion),
          line_index: 1,
          committed_qty: 2,
          last_reference_id: "r",
          last_committed_at: "",
          created_at: "",
          updated_at: "",
        },
      ],
      hasBaseRecipeSet: new Set(["burger"]),
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(1);
  });
});
