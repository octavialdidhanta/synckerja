import { describe, expect, it } from "vitest";
import { applyScanToSkuField } from "./applyScanToSkuField";

describe("applyScanToSkuField", () => {
  it("returns trimmed product barcode", () => {
    expect(applyScanToSkuField("  ABC-01  ")).toBe("ABC-01");
  });

  it("ignores guest SYNK QR", () => {
    expect(applyScanToSkuField("SYNK:ABCDEFGH")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(applyScanToSkuField("   ")).toBeNull();
  });
});
