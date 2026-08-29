import { describe, expect, it } from "vitest";
import {
  computeInvoiceDisplayStatus,
  computeOverdueDays,
} from "./computeInvoiceDisplayStatus";

describe("computeInvoiceDisplayStatus", () => {
  const asOf = new Date("2026-08-28T12:00:00Z");

  it("returns cancelled when invoice_cancelled_at is set", () => {
    expect(
      computeInvoiceDisplayStatus({
        invoiceCancelledAt: "2026-08-01T00:00:00Z",
        invoiceDueDate: "2026-08-01",
        paymentStatus: "paid",
        totalAmount: 100,
        totalPaidAmount: 100,
        today: asOf,
      }),
    ).toBe("cancelled");
  });

  it("returns paid when paid >= total", () => {
    expect(
      computeInvoiceDisplayStatus({
        invoiceCancelledAt: null,
        invoiceDueDate: "2026-09-01",
        paymentStatus: "partial",
        totalAmount: 100,
        totalPaidAmount: 100,
        today: asOf,
      }),
    ).toBe("paid");
  });

  it("returns overdue for unpaid past due date", () => {
    expect(
      computeInvoiceDisplayStatus({
        invoiceCancelledAt: null,
        invoiceDueDate: "2026-08-01",
        paymentStatus: "unpaid",
        totalAmount: 100,
        totalPaidAmount: 0,
        today: asOf,
      }),
    ).toBe("overdue");
  });

  it("returns partial for partial payment before due date", () => {
    expect(
      computeInvoiceDisplayStatus({
        invoiceCancelledAt: null,
        invoiceDueDate: "2026-09-01",
        paymentStatus: "partial",
        totalAmount: 100,
        totalPaidAmount: 40,
        today: asOf,
      }),
    ).toBe("partial");
  });

  it("returns overdue for partial payment past due date", () => {
    expect(
      computeInvoiceDisplayStatus({
        invoiceCancelledAt: null,
        invoiceDueDate: "2026-08-01",
        paymentStatus: "partial",
        totalAmount: 100,
        totalPaidAmount: 40,
        today: asOf,
      }),
    ).toBe("overdue");
  });
});

describe("computeOverdueDays", () => {
  it("returns null when not overdue", () => {
    expect(
      computeOverdueDays("2026-09-01", null, new Date("2026-08-28T12:00:00Z")),
    ).toBeNull();
  });

  it("returns positive days when overdue", () => {
    expect(
      computeOverdueDays("2026-08-01", null, new Date("2026-08-28T12:00:00Z")),
    ).toBe(27);
  });
});
