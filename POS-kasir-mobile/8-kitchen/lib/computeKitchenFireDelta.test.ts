import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLineFingerprint } from "@/pos-mobile/2-cashier/lib/cartLineFingerprint";
import {
  computeKitchenFireDelta,
  kitchenFireDeltaToCartLines,
} from "./computeKitchenFireDelta";

function productLine(id: string, qty: number): CustomerVisitCartLine {
  return {
    kind: "product",
    catalogId: id,
    name: "Nasi",
    unitPrice: 15000,
    quantity: qty,
    isCustomAmount: false,
  } as CustomerVisitCartLine;
}

describe("computeKitchenFireDelta", () => {
  it("returns full cart when nothing fired", () => {
    const line = productLine("a", 3);
    const fp = cartLineFingerprint(line);
    const deltas = computeKitchenFireDelta([line], new Map());
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.deltaQty).toBe(3);
    expect(kitchenFireDeltaToCartLines(deltas)[0]?.quantity).toBe(3);
  });

  it("returns partial delta when partially fired", () => {
    const line = productLine("a", 3);
    const fp = cartLineFingerprint(line);
    const deltas = computeKitchenFireDelta([line], new Map([[fp, 2]]));
    expect(deltas[0]?.deltaQty).toBe(1);
  });

  it("returns empty when fully fired", () => {
    const line = productLine("a", 2);
    const fp = cartLineFingerprint(line);
    expect(computeKitchenFireDelta([line], new Map([[fp, 2]]))).toHaveLength(0);
  });
});
