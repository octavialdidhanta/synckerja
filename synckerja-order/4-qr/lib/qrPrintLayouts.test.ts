import { describe, expect, it } from "vitest";
import { paperSizeClass, qrCodeSizeForTemplate, templateClass } from "./qrPrintLayouts";

describe("qrPrintLayouts", () => {
  it("returns larger QR for print than preview", () => {
    expect(qrCodeSizeForTemplate("classic", true)).toBeGreaterThan(
      qrCodeSizeForTemplate("classic", false),
    );
  });

  it("maps paper and template classes", () => {
    expect(paperSizeClass("a5")).toBe("qr-print-page--a5");
    expect(templateClass("tent")).toBe("qr-table-card--tent");
  });
});
