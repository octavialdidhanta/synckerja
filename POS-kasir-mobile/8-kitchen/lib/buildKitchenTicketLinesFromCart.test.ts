import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { buildKitchenTicketLinesFromCart } from "./buildKitchenTicketLinesFromCart";
import { nextKitchenTicketStatus } from "./kitchenTicketStatus";

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

describe("buildKitchenTicketLinesFromCart", () => {
  it("skips custom amounts and non-products", () => {
    const lines = buildKitchenTicketLinesFromCart([
      productLine({ catalogId: "a", quantity: 2, serviceName: "Nasi Telur" }),
      productLine({
        catalogId: "custom",
        quantity: 1,
        isCustomAmount: true,
        serviceName: "Custom",
      }),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.display_name).toContain("Nasi Telur");
    expect(lines[0]?.quantity).toBe(2);
  });

  it("includes variant and modifiers in modifiers_text", () => {
    const lines = buildKitchenTicketLinesFromCart([
      productLine({
        catalogId: "b",
        quantity: 1,
        variantName: "Pedas",
        modifiers: [{ optionId: "m1", name: "Extra telur", extraPrice: 0 }],
      }),
    ]);
    expect(lines[0]?.modifiers_text).toContain("Pedas");
    expect(lines[0]?.modifiers_text).toContain("Extra telur");
  });

  it("appends option qty and kitchen note", () => {
    const lines = buildKitchenTicketLinesFromCart([
      productLine({
        catalogId: "c",
        quantity: 1,
        modifiers: [{ optionId: "m1", name: "Lemon Tea - Iced", extraPrice: 0, quantity: 2 }],
        kitchenNote: "kurang es",
      }),
    ]);
    expect(lines[0]?.modifiers_text).toContain("Lemon Tea - Iced ×2");
    expect(lines[0]?.modifiers_text).toContain("Catatan: kurang es");
  });
});

describe("nextKitchenTicketStatus", () => {
  it("advances new → in_progress → ready → done", () => {
    expect(nextKitchenTicketStatus("new")).toBe("in_progress");
    expect(nextKitchenTicketStatus("in_progress")).toBe("ready");
    expect(nextKitchenTicketStatus("ready")).toBe("done");
    expect(nextKitchenTicketStatus("done")).toBeNull();
    expect(nextKitchenTicketStatus("void")).toBeNull();
  });
});
