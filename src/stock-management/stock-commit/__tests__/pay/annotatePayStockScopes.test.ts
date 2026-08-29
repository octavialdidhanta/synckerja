import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { annotatePayStockScopes } from "../../lib/pay/annotatePayStockScopes";

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

describe("annotatePayStockScopes", () => {
  it("pay mode uses full", () => {
    const out = annotatePayStockScopes({
      lines: [line({ catalogId: "p1" })],
      commitPoint: "pay",
      hasBaseRecipeSet: new Set(["p1"]),
    });
    expect(out[0]?.stockScope).toBe("full");
  });

  it("kitchen retailTracked uses finished_goods_only", () => {
    const out = annotatePayStockScopes({
      lines: [line({ catalogId: "cola", trackStock: true })],
      commitPoint: "kitchen",
      hasBaseRecipeSet: new Set(),
    });
    expect(out[0]?.stockScope).toBe("finished_goods_only");
  });

  it("kitchen hybrid trackStock+recipe uses finished_goods_only at pay", () => {
    const out = annotatePayStockScopes({
      lines: [line({ catalogId: "kit", trackStock: true })],
      commitPoint: "kitchen",
      hasBaseRecipeSet: new Set(["kit"]),
    });
    expect(out[0]?.stockScope).toBe("finished_goods_only");
  });

  it("kitchen recipeMenu uses recipe_only", () => {
    const out = annotatePayStockScopes({
      lines: [line({ catalogId: "burger" })],
      commitPoint: "kitchen",
      hasBaseRecipeSet: new Set(["burger"]),
    });
    expect(out[0]?.stockScope).toBe("recipe_only");
  });
});
