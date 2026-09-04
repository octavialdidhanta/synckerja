import { describe, expect, it } from "vitest";
import { buildTestPrintEscPos } from "./buildTestPrintEscPos";

describe("buildTestPrintEscPos", () => {
  it("emits ESC/POS init and cut bytes", () => {
    const bytes = buildTestPrintEscPos({
      printerName: "RPP02N",
      outletName: "Demo Outlet",
    });
    expect(bytes.length).toBeGreaterThan(20);
    // ESC @
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    // GS V 0 (full cut) somewhere near the end
    const asArr = Array.from(bytes);
    const cutIdx = asArr.findIndex(
      (b, i) => b === 0x1d && asArr[i + 1] === 0x56 && asArr[i + 2] === 0x00,
    );
    expect(cutIdx).toBeGreaterThan(0);
    const text = String.fromCharCode(...asArr.filter((b) => b >= 0x20 && b <= 0x7e));
    expect(text).toContain("TEST PRINT");
    expect(text).toContain("RPP02N");
  });
});
