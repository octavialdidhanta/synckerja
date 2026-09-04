import { describe, expect, it } from "vitest";
import {
  parsePosScanPayload,
  tryParseBareGuestClaimToken,
} from "./parsePosScanPayload";

describe("parsePosScanPayload", () => {
  it("parses SYNK guest QR", () => {
    expect(parsePosScanPayload("SYNK:ABCDEFGH")).toEqual({
      kind: "guest_qr",
      token: "ABCDEFGH",
    });
  });

  it("treats non-SYNK as product code", () => {
    expect(parsePosScanPayload("  sku-123  ")).toEqual({
      kind: "product",
      code: "sku-123",
    });
  });

  it("returns null for empty", () => {
    expect(parsePosScanPayload("   ")).toBeNull();
  });

  it("rejects short SYNK token", () => {
    expect(parsePosScanPayload("SYNK:ABC")).toEqual({
      kind: "product",
      code: "SYNK:ABC",
    });
  });
});

describe("tryParseBareGuestClaimToken", () => {
  it("accepts bare 8+ char tokens", () => {
    expect(tryParseBareGuestClaimToken("ABCDEFGH")).toBe("ABCDEFGH");
  });

  it("rejects short tokens", () => {
    expect(tryParseBareGuestClaimToken("ABC")).toBeNull();
  });
});
