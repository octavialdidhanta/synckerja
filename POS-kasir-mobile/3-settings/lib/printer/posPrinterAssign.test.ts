import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { writePosPrinterSettings } from "./posPrinterStorage";
import { createPosSavedPrinter } from "./posPrinterStorage";
import { outletHasReceiptBillPrinter, posPrinterSettingsPath } from "./posPrinterAssign";

describe("posPrinterAssign", () => {
  const outletId = "outlet-test-assign";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("builds settings path with printer section", () => {
    expect(posPrinterSettingsPath()).toBe("/pos/settings?section=printer");
  });

  it("returns false when no printers saved", () => {
    expect(outletHasReceiptBillPrinter(outletId)).toBe(false);
    expect(outletHasReceiptBillPrinter(null)).toBe(false);
  });

  it("returns true when a printer has receipt_bill", () => {
    const printer = createPosSavedPrinter({
      address: "AA:BB",
      systemName: "Test",
    });
    writePosPrinterSettings(outletId, {
      printers: [printer],
      ticketCopies: 1,
      printTicketOnPay: false,
      printTicketPerProduct: false,
    });
    expect(outletHasReceiptBillPrinter(outletId)).toBe(true);
  });

  it("returns false when receipt_bill is off", () => {
    const printer = createPosSavedPrinter({
      address: "AA:BB",
      systemName: "Test",
    });
    printer.roles.receipt_bill = false;
    writePosPrinterSettings(outletId, {
      printers: [printer],
      ticketCopies: 1,
      printTicketOnPay: false,
      printTicketPerProduct: false,
    });
    expect(outletHasReceiptBillPrinter(outletId)).toBe(false);
  });
});
