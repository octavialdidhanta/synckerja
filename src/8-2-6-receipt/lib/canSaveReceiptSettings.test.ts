import { describe, expect, it } from "vitest";
import { canSaveReceiptSettings } from "./canSaveReceiptSettings";

describe("canSaveReceiptSettings", () => {
  it("disables save when not dirty", () => {
    expect(
      canSaveReceiptSettings({
        busy: false,
        isDirty: false,
        outletName: "Main",
        businessName: "Co",
      }),
    ).toBe(false);
  });

  it("enables save when dirty with required names", () => {
    expect(
      canSaveReceiptSettings({
        busy: false,
        isDirty: true,
        outletName: "Main",
        businessName: "Co",
      }),
    ).toBe(true);
  });

  it("disables while saving or names empty", () => {
    expect(
      canSaveReceiptSettings({
        busy: true,
        isDirty: true,
        outletName: "Main",
        businessName: "Co",
      }),
    ).toBe(false);
    expect(
      canSaveReceiptSettings({
        busy: false,
        isDirty: true,
        outletName: "  ",
        businessName: "Co",
      }),
    ).toBe(false);
  });
});
