import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { computeCommitDelta, cartLineCommitFingerprint } from "../lib/computeCommitDelta";
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
    trackStock: false,
    inventorySkuId: null,
    availableQty: null,
    ...partial,
  };
}

function commit(fp: string, qty: number): PosSessionStockCommit {
  return {
    id: "c1",
    organization_id: "o1",
    outlet_id: "out1",
    session_id: "s1",
    line_fingerprint: fp,
    line_index: 1,
    committed_qty: qty,
    last_reference_id: "ref",
    last_committed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("computeCommitDelta", () => {
  it("returns full qty when nothing committed", () => {
    const cart = [line({ catalogId: "p1", quantity: 2 })];
    const deltas = computeCommitDelta(cart, []);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.deltaQty).toBe(2);
  });

  it("returns delta when partially committed", () => {
    const cart = [line({ catalogId: "p1", quantity: 3 })];
    const fp = cartLineCommitFingerprint(cart[0]!);
    const deltas = computeCommitDelta(cart, [commit(fp, 2)]);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.deltaQty).toBe(1);
  });

  it("returns empty when fully committed", () => {
    const cart = [line({ catalogId: "p1", quantity: 2 })];
    const fp = cartLineCommitFingerprint(cart[0]!);
    const deltas = computeCommitDelta(cart, [commit(fp, 2)]);
    expect(deltas).toHaveLength(0);
  });

  it("skips custom amount lines", () => {
    const cart = [line({ catalogId: "custom", isCustomAmount: true, quantity: 1 })];
    expect(computeCommitDelta(cart, [])).toHaveLength(0);
  });

  it("modifier change produces new fingerprint and full delta", () => {
    const base = line({
      catalogId: "p1",
      quantity: 2,
      modifiers: [{ groupId: "g1", optionId: "o1", name: "Spicy", extraPrice: 0 }],
    });
    const changed = line({
      catalogId: "p1",
      quantity: 2,
      modifiers: [{ groupId: "g1", optionId: "o2", name: "Mild", extraPrice: 0 }],
    });
    const fpBase = cartLineCommitFingerprint(base);
    const deltas = computeCommitDelta([changed], [commit(fpBase, 2)]);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.deltaQty).toBe(2);
  });
});
