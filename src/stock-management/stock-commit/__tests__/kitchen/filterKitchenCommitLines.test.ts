import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { filterKitchenCommitLines } from "../../lib/kitchen/filterKitchenCommitLines";
import type { CommitDeltaLine } from "../../lib/computeCommitDelta";
import { cartLineCommitFingerprint } from "../../lib/computeCommitDelta";

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

function delta(l: CustomerVisitCartLine, lineIndex: number): CommitDeltaLine {
  return {
    line: l,
    lineIndex,
    lineFingerprint: cartLineCommitFingerprint(l),
    deltaQty: Number(l.quantity) || 1,
    committedQty: 0,
    cartQty: Number(l.quantity) || 1,
  };
}

describe("filterKitchenCommitLines", () => {
  it("keeps recipe products", () => {
    const d = delta(line({ catalogId: "burger" }), 1);
    const out = filterKitchenCommitLines([d], new Set(["burger"]));
    expect(out).toHaveLength(1);
  });

  it("skips trackStock-only without recipe", () => {
    const d = delta(line({ catalogId: "cola", trackStock: true }), 1);
    const out = filterKitchenCommitLines([d], new Set());
    expect(out).toHaveLength(0);
  });

  it("keeps hybrid trackStock + recipe", () => {
    const d = delta(line({ catalogId: "kit", trackStock: true }), 1);
    const out = filterKitchenCommitLines([d], new Set(["kit"]));
    expect(out).toHaveLength(1);
  });
});
