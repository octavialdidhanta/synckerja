import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  aggregateReserveTargetsFromCart,
  computeReserveDelta,
} from "../../lib/reserve/computeReserveDelta";
import type { PosSessionStockReserve } from "../../types/sessionStockReserve";
import { NULL_VARIANT_SENTINEL } from "../../types/sessionStockReserve";

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
    trackStock: partial.trackStock ?? true,
    inventorySkuId: null,
    variantId: partial.variantId ?? null,
    availableQty: null,
    ...partial,
  };
}

function reserve(
  productId: string,
  qty: number,
  variantId: string = NULL_VARIANT_SENTINEL,
): PosSessionStockReserve {
  return {
    id: "r1",
    organization_id: "o1",
    outlet_id: "out1",
    session_id: "s1",
    product_id: productId,
    variant_id: variantId,
    reserved_qty: qty,
    last_reference_id: "ref",
    last_reserved_at: "",
    created_at: "",
    updated_at: "",
  };
}

describe("aggregateReserveTargetsFromCart", () => {
  it("sums duplicate product lines", () => {
    const targets = aggregateReserveTargetsFromCart([
      line({ catalogId: "p1", quantity: 2 }),
      line({ catalogId: "p1", quantity: 3 }),
    ]);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.qty).toBe(5);
  });

  it("ignores non-tracked products", () => {
    expect(
      aggregateReserveTargetsFromCart([line({ catalogId: "p1", trackStock: false })]),
    ).toHaveLength(0);
  });

  it("separates variants", () => {
    const targets = aggregateReserveTargetsFromCart([
      line({ catalogId: "p1", variantId: "v1", quantity: 1 }),
      line({ catalogId: "p1", variantId: "v2", quantity: 2 }),
    ]);
    expect(targets).toHaveLength(2);
  });
});

describe("computeReserveDelta", () => {
  it("first save reserves full target qty", () => {
    const deltas = computeReserveDelta({
      cartLines: [line({ catalogId: "p1", quantity: 3 })],
      reserves: [],
    });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.deltaQty).toBe(3);
    expect(deltas[0]?.currentQty).toBe(0);
  });

  it("re-save with increased qty reserves only delta", () => {
    const deltas = computeReserveDelta({
      cartLines: [line({ catalogId: "p1", quantity: 5 })],
      reserves: [reserve("p1", 3)],
    });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.deltaQty).toBe(2);
  });

  it("re-save with decreased qty produces negative delta", () => {
    const deltas = computeReserveDelta({
      cartLines: [line({ catalogId: "p1", quantity: 2 })],
      reserves: [reserve("p1", 5)],
    });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.deltaQty).toBe(-3);
  });

  it("no delta when cart matches ledger", () => {
    const deltas = computeReserveDelta({
      cartLines: [line({ catalogId: "p1", quantity: 4 })],
      reserves: [reserve("p1", 4)],
    });
    expect(deltas).toHaveLength(0);
  });
});
