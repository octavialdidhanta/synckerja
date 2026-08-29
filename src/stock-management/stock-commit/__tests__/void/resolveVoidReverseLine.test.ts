import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { resolveVoidReverseLine } from "../../lib/void/resolveVoidReverseLine";
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

function commit(fp: string, qty: number, lineIndex: number): PosSessionStockCommit {
  return {
    id: `c-${lineIndex}`,
    organization_id: "o1",
    outlet_id: "out1",
    session_id: "s1",
    line_fingerprint: fp,
    line_index: lineIndex,
    committed_qty: qty,
    last_reference_id: "ref",
    last_committed_at: "",
    created_at: "",
    updated_at: "",
  };
}

describe("resolveVoidReverseLine", () => {
  it("uses ledger line_index not cart re-index (L2)", () => {
    const spicy = line({
      catalogId: "burger",
      modifiers: [{ groupId: "g", optionId: "spicy", name: "Spicy", extraPrice: 0 }],
    });
    const mild = line({
      catalogId: "burger",
      modifiers: [{ groupId: "g", optionId: "mild", name: "Mild", extraPrice: 0 }],
    });
    const fpMild = cartLineCommitFingerprint(mild);
    const resolved = resolveVoidReverseLine({
      line: mild,
      voidQty: 1,
      commits: [
        commit(cartLineCommitFingerprint(spicy), 1, 1),
        commit(fpMild, 1, 2),
      ],
    });
    expect(resolved?.lineIndex).toBe(2);
    expect(resolved?.reverseQty).toBe(1);
    expect(resolved?.lineFingerprint).toBe(fpMild);
  });

  it("returns null when not committed", () => {
    const l = line({ catalogId: "p1" });
    expect(resolveVoidReverseLine({ line: l, voidQty: 1, commits: [] })).toBeNull();
  });

  it("caps reverse qty to committed", () => {
    const l = line({ catalogId: "p1", quantity: 5 });
    const fp = cartLineCommitFingerprint(l);
    const resolved = resolveVoidReverseLine({
      line: l,
      voidQty: 10,
      commits: [commit(fp, 2, 3)],
    });
    expect(resolved?.reverseQty).toBe(2);
    expect(resolved?.lineIndex).toBe(3);
  });
});
