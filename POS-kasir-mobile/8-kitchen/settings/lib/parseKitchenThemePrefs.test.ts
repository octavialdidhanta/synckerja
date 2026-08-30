import { describe, expect, it } from "vitest";
import {
  isValidKitchenHex,
  normalizeKitchenHex,
  parseKitchenFontSize,
  parseKitchenThemeColors,
} from "./parseKitchenThemePrefs";

describe("parseKitchenThemePrefs", () => {
  it("validates hex", () => {
    expect(isValidKitchenHex("#9fb6ff")).toBe(true);
    expect(isValidKitchenHex("#FFF")).toBe(false);
    expect(normalizeKitchenHex("#9FB6FF")).toBe("#9fb6ff");
    expect(normalizeKitchenHex("red")).toBeNull();
  });

  it("parses font size with fallback", () => {
    expect(parseKitchenFontSize("large")).toBe("large");
    expect(parseKitchenFontSize("huge")).toBe("default");
  });

  it("merges partial colors", () => {
    const parsed = parseKitchenThemeColors({
      order_types: { dine_in: "#112233" },
      status: { late: "#abcdef" },
    });
    expect(parsed.order_types.dine_in).toBe("#112233");
    expect(parsed.order_types.takeaway).toBe("#84b4e3");
    expect(parsed.status.late).toBe("#abcdef");
    expect(parsed.status.on_time).toBe("#14b768");
  });
});
