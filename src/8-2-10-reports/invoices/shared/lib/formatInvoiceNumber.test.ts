import { describe, expect, it } from "vitest";
import { formatInvoiceNumberFromActivityId, addDaysToYmd } from "./formatInvoiceNumber";

describe("formatInvoiceNumberFromActivityId", () => {
  it("formats INV- prefix with upper 8 hex chars", () => {
    expect(
      formatInvoiceNumberFromActivityId("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    ).toBe("INV-A1B2C3D4");
  });
});

describe("addDaysToYmd", () => {
  it("adds days to ymd string", () => {
    expect(addDaysToYmd("2026-08-28", 30)).toBe("2026-09-27");
  });
});
