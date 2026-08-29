import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  computePayStockDelta,
  computePayStockDeltaDetailed,
} from "../../lib/pay/computePayStockDelta";
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
    trackStock: partial.trackStock ?? false,
    inventorySkuId: partial.inventorySkuId ?? null,
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
    last_committed_at: "",
    created_at: "",
    updated_at: "",
  };
}

const recipeSet = new Set(["burger"]);

describe("computePayStockDelta", () => {
  it("pay mode returns all lines with full qty", () => {
    const lines = [line({ catalogId: "burger", quantity: 3 })];
    const result = computePayStockDelta({
      lines,
      commitPoint: "pay",
      commits: [],
      hasBaseRecipeSet: recipeSet,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(3);
  });

  it("fulfillment mode returns empty", () => {
    const lines = [line({ catalogId: "sku1", trackStock: true, quantity: 2 })];
    expect(
      computePayStockDelta({
        lines,
        commitPoint: "fulfillment",
        commits: [],
        hasBaseRecipeSet: new Set(),
      }),
    ).toHaveLength(0);
  });

  it("kitchen direct pay deducts full uncommitted recipe qty", () => {
    const l = line({ catalogId: "burger", quantity: 3 });
    const result = computePayStockDelta({
      lines: [l],
      commitPoint: "kitchen",
      commits: [],
      hasBaseRecipeSet: recipeSet,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(3);
  });

  it("kitchen partial committed deducts only remaining qty at pay", () => {
    const l = line({ catalogId: "burger", quantity: 3 });
    const fp = cartLineCommitFingerprint(l);
    const result = computePayStockDelta({
      lines: [l],
      commitPoint: "kitchen",
      commits: [commit(fp, 2)],
      hasBaseRecipeSet: recipeSet,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(1);
  });

  it("kitchen fully committed recipe line skipped at pay", () => {
    const l = line({ catalogId: "burger", quantity: 2 });
    const fp = cartLineCommitFingerprint(l);
    const result = computePayStockDelta({
      lines: [l],
      commitPoint: "kitchen",
      commits: [commit(fp, 2)],
      hasBaseRecipeSet: recipeSet,
    });
    expect(result).toHaveLength(0);
  });

  it("kitchen retail tracked deducts full cart qty at pay", () => {
    const l = line({ catalogId: "cola", trackStock: true, quantity: 4 });
    const fp = cartLineCommitFingerprint(l);
    const result = computePayStockDelta({
      lines: [l],
      commitPoint: "kitchen",
      commits: [commit(fp, 1)],
      hasBaseRecipeSet: new Set(),
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(4);
  });

  it("kitchen legacy sku uses uncommitted qty", () => {
    const l = line({ catalogId: "legacy", inventorySkuId: "sku-old", quantity: 3 });
    const fp = cartLineCommitFingerprint(l);
    const result = computePayStockDelta({
      lines: [l],
      commitPoint: "kitchen",
      commits: [commit(fp, 1)],
      hasBaseRecipeSet: new Set(),
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(2);
  });

  it("recipe detection requires hasBaseRecipeSet", () => {
    const l = line({ catalogId: "burger", quantity: 2 });
    const withoutRecipe = computePayStockDelta({
      lines: [l],
      commitPoint: "kitchen",
      commits: [],
      hasBaseRecipeSet: new Set(),
    });
    expect(withoutRecipe).toHaveLength(0);
  });

  it("detailed delta exposes committed and pay qty", () => {
    const l = line({ catalogId: "burger", quantity: 3 });
    const fp = cartLineCommitFingerprint(l);
    const detailed = computePayStockDeltaDetailed({
      lines: [l],
      commitPoint: "kitchen",
      commits: [commit(fp, 2)],
      hasBaseRecipeSet: recipeSet,
    });
    expect(detailed[0]?.committedQty).toBe(2);
    expect(detailed[0]?.payQty).toBe(1);
  });

  it("skips custom amount lines", () => {
    const lines = [line({ catalogId: "x", isCustomAmount: true })];
    expect(
      computePayStockDelta({
        lines,
        commitPoint: "pay",
        commits: [],
        hasBaseRecipeSet: new Set(),
      }),
    ).toHaveLength(0);
  });
});
