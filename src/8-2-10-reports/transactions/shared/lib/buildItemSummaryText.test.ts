import { describe, expect, it } from "vitest";
import { buildItemSummaryText } from "./buildItemSummaryText";

describe("buildItemSummaryText", () => {
  it("returns em dash for empty names", () => {
    expect(buildItemSummaryText([])).toBe("—");
    expect(buildItemSummaryText(["", "  "])).toBe("—");
  });

  it("joins up to 3 item names", () => {
    expect(buildItemSummaryText(["Milk Tea", "Coffee", "Tea"])).toBe(
      "Milk Tea, Coffee, Tea",
    );
  });

  it("truncates beyond max items with suffix", () => {
    expect(buildItemSummaryText(["A", "B", "C", "D", "E"], 3)).toBe("A, B, C +2");
  });
});
