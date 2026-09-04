import { describe, expect, it } from "vitest";
import { formatRefundLedgerReason } from "./formatRefundWasteReason";

describe("formatRefundLedgerReason", () => {
  it("returns null when empty", () => {
    expect(formatRefundLedgerReason("restore", "  ")).toBeNull();
    expect(formatRefundLedgerReason("waste", null)).toBeNull();
  });

  it("keeps restore reasons raw", () => {
    expect(formatRefundLedgerReason("restore", "  guest request ")).toBe(
      "guest request",
    );
  });

  it("prefixes waste reasons via kitchenWasteNote", () => {
    expect(formatRefundLedgerReason("waste", " already cooked ")).toBe(
      "Kitchen waste: already cooked",
    );
  });
});
