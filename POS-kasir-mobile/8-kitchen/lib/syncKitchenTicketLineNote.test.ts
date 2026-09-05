import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLineFingerprint } from "@/pos-mobile/2-cashier/lib/cartLineFingerprint";
import { computeKitchenFireDelta } from "./computeKitchenFireDelta";
import { planKitchenTicketLineNoteSync } from "./syncKitchenTicketLineNote";

function productLine(
  overrides: Partial<CustomerVisitCartLine> & Pick<CustomerVisitCartLine, "catalogId" | "quantity">,
): CustomerVisitCartLine {
  return {
    lineKey: overrides.catalogId,
    catalogId: overrides.catalogId,
    kind: "product",
    serviceId: null,
    subServiceId: null,
    serviceName: overrides.serviceName ?? "Nasi",
    subServiceName: overrides.subServiceName ?? null,
    quantity: overrides.quantity,
    unitPrice: 10000,
    trackStock: false,
    inventorySkuId: null,
    availableQty: null,
    ...overrides,
  };
}

describe("planKitchenTicketLineNoteSync", () => {
  it("plans fingerprint migrate when note is added after plain fire", () => {
    const before = productLine({ catalogId: "nasi", quantity: 2 });
    const previousFingerprint = cartLineFingerprint(before);
    expect(previousFingerprint).toBe("plain:nasi");

    const next = productLine({
      catalogId: "nasi",
      quantity: 2,
      kitchenNote: "kurang pedas",
    });
    next.lineKey = cartLineFingerprint(next);

    const plan = planKitchenTicketLineNoteSync({ previousFingerprint, nextLine: next });
    expect(plan).not.toBeNull();
    expect(plan!.fingerprintChanged).toBe(true);
    expect(plan!.previousFingerprint).toBe("plain:nasi");
    expect(plan!.nextFingerprint).toBe(cartLineFingerprint(next));
    expect(plan!.modifiersText).toContain("Catatan: kurang pedas");
  });

  it("plans clear note back to plain fingerprint", () => {
    const before = productLine({
      catalogId: "nasi",
      quantity: 1,
      kitchenNote: "tanpa bawang",
    });
    const previousFingerprint = cartLineFingerprint(before);
    const next = productLine({ catalogId: "nasi", quantity: 1, kitchenNote: null });
    next.lineKey = cartLineFingerprint(next);

    const plan = planKitchenTicketLineNoteSync({ previousFingerprint, nextLine: next });
    expect(plan!.fingerprintChanged).toBe(true);
    expect(plan!.nextFingerprint).toBe("plain:nasi");
    expect(plan!.modifiersText).toBeNull();
  });

  it("keeps fingerprint when only whitespace note sanitizes to same", () => {
    const before = productLine({
      catalogId: "nasi",
      quantity: 1,
      kitchenNote: "halal",
    });
    const previousFingerprint = cartLineFingerprint(before);
    const next = productLine({
      catalogId: "nasi",
      quantity: 1,
      kitchenNote: "  halal  ",
    });
    // sanitize happens in caller; plan uses line as-is — fingerprint uses kitchenNoteFingerprint
    next.kitchenNote = "halal";
    next.lineKey = cartLineFingerprint(next);

    const plan = planKitchenTicketLineNoteSync({ previousFingerprint, nextLine: next });
    expect(plan!.fingerprintChanged).toBe(false);
    expect(plan!.modifiersText).toContain("Catatan: halal");
  });

  it("returns null for custom amount", () => {
    const line = productLine({
      catalogId: "x",
      quantity: 1,
      isCustomAmount: true,
      kitchenNote: "x",
    });
    expect(
      planKitchenTicketLineNoteSync({
        previousFingerprint: "custom:x",
        nextLine: line,
      }),
    ).toBeNull();
  });
});

describe("computeKitchenFireDelta after note fingerprint migrate", () => {
  it("does not re-fire when fired map uses migrated fingerprint", () => {
    const withNote = productLine({
      catalogId: "nasi",
      quantity: 2,
      kitchenNote: "kurang es",
    });
    withNote.lineKey = cartLineFingerprint(withNote);
    const fp = cartLineFingerprint(withNote);

    const fired = new Map<string, number>([[fp, 2]]);
    expect(computeKitchenFireDelta([withNote], fired)).toEqual([]);
  });

  it("would duplicate if fired map still has old plain fingerprint (regression guard)", () => {
    const withNote = productLine({
      catalogId: "nasi",
      quantity: 2,
      kitchenNote: "kurang es",
    });
    withNote.lineKey = cartLineFingerprint(withNote);

    // Bug state: KDS still keyed as plain — delta sees full qty as unfired.
    const firedStale = new Map<string, number>([["plain:nasi", 2]]);
    const deltas = computeKitchenFireDelta([withNote], firedStale);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.deltaQty).toBe(2);
  });
});
