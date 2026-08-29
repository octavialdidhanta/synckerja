import { describe, expect, it } from "vitest";
import { computeCatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { mergePosCheckoutTotalsWithCustom } from "./posCustomAmount";

describe("mergePosCheckoutTotalsWithCustom", () => {
  it("preserves taxBase and taxLines when adding untaxed custom amount", () => {
    const priced = computeCatalogCheckoutTotals({
      subtotal: 100_000,
      settings: {
        tax_enabled: true,
        gratuity_enabled: true,
        application_method: "add",
      },
      taxes: [{ id: "t1", name: "PPN", amount_percent: 11 }],
      gratuities: [{ id: "g1", name: "Service", amount_percent: 5 }],
    });

    const merged = mergePosCheckoutTotalsWithCustom(priced, 50_000);

    expect(merged.taxBase).toBe(priced.taxBase);
    expect(merged.taxLines).toEqual(priced.taxLines);
    expect(merged.taxTotal).toBe(priced.taxTotal);
    expect(merged.subtotal).toBe(priced.subtotal + 50_000);
    expect(merged.grandTotal).toBe(priced.grandTotal + 50_000);
  });
});
