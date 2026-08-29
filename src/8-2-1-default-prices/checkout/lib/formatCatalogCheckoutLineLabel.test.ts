import { describe, expect, it } from "vitest";
import {
  formatCatalogCheckoutLineLabel,
  formatCatalogRatePercentCompact,
} from "./formatCatalogCheckoutLineLabel";

describe("formatCatalogRatePercentCompact", () => {
  it("formats integers without decimals", () => {
    expect(formatCatalogRatePercentCompact(10)).toBe("10%");
  });

  it("uses locale decimal separator", () => {
    expect(formatCatalogRatePercentCompact(2.5, "en")).toBe("2.5%");
    expect(formatCatalogRatePercentCompact(2.5, "id")).toBe("2,5%");
  });
});

describe("formatCatalogCheckoutLineLabel", () => {
  it("appends percent in parentheses", () => {
    expect(
      formatCatalogCheckoutLineLabel({ name: "Service Fee", amountPercent: 10 }),
    ).toBe("Service Fee (10%)");
  });

  it("does not duplicate percent already in the name", () => {
    expect(
      formatCatalogCheckoutLineLabel({ name: "PPN (11%)", amountPercent: 11 }),
    ).toBe("PPN (11%)");
  });

  it("appends included suffix after the rate", () => {
    expect(
      formatCatalogCheckoutLineLabel({
        name: "Tax",
        amountPercent: 11,
        includedLabel: "included",
      }),
    ).toBe("Tax (11%) (included)");
  });
});
