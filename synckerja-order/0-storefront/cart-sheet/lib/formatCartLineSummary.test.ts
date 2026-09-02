import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { formatCartLineSummary } from "./formatCartLineSummary";

function line(
  patch: Partial<Pick<CustomerVisitCartLine, "kind" | "serviceName" | "quantity" | "variantName" | "modifiers">>,
): Pick<CustomerVisitCartLine, "kind" | "serviceName" | "quantity" | "variantName" | "modifiers"> {
  return {
    kind: "product",
    serviceName: "Combat",
    quantity: 1,
    variantName: null,
    modifiers: [],
    ...patch,
  };
}

describe("formatCartLineSummary", () => {
  it("lists variant then modifiers with option qty", () => {
    expect(
      formatCartLineSummary(
        line({
          variantName: "Regular",
          modifiers: [
            { optionId: "o1", name: "Lemon Tea - Iced", extraPrice: 0, quantity: 2 },
            { optionId: "o2", name: "Lv 0", extraPrice: 0, quantity: 1 },
          ],
        }),
      ),
    ).toEqual(["x1 Regular", "x2 Lemon Tea - Iced", "x1 Lv 0"]);
  });

  it("lists bundle included items when provided", () => {
    expect(
      formatCartLineSummary(line({ kind: "bundle", serviceName: "Paket" }), [
        { name: "Mie", quantity: 1 },
        { name: "Es Teh", quantity: 2 },
      ]),
    ).toEqual(["x1 Mie", "x2 Es Teh"]);
  });

  it("falls back to the product name for a plain line", () => {
    expect(formatCartLineSummary(line({ quantity: 3 }))).toEqual(["x3 Combat"]);
  });
});
