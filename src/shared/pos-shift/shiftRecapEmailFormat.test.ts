import { describe, expect, it } from "vitest";
import {
  buildShiftRecapEmailHtml,
  buildShiftRecapEmailSubject,
  dedupeEmails,
  formatShiftRecapMoney,
  formatShiftRecapVariance,
  paymentMethodLabel,
} from "./shiftRecapEmailFormat";

describe("shiftRecapEmailFormat", () => {
  it("formats money in IDR", () => {
    expect(formatShiftRecapMoney(4000)).toBe("Rp. 4.000");
  });

  it("formats shortage variance in parentheses", () => {
    expect(formatShiftRecapVariance(-4000)).toBe("(Rp. 4.000)");
    expect(formatShiftRecapVariance(4000)).toBe("Rp. 4.000");
    expect(formatShiftRecapVariance(0)).toBe("Rp. 0");
  });

  it("dedupes and normalizes recipient emails", () => {
    expect(
      dedupeEmails([
        "Owner@Example.com",
        "owner@example.com",
        " bad ",
        "not-an-email",
        "admin@example.com",
      ]),
    ).toEqual(["owner@example.com", "admin@example.com"]);
  });

  it("localizes payment method labels", () => {
    expect(paymentMethodLabel("cash", "id")).toBe("Tunai");
    expect(paymentMethodLabel("cash", "en")).toBe("Cash");
    expect(paymentMethodLabel("qris", "en")).toBe("QRIS");
    expect(paymentMethodLabel("qris", "id")).toBe("QRIS");
  });

  it("builds subject with outlet and cashier", () => {
    const subject = buildShiftRecapEmailSubject(
      {
        outlet_name: "Main Store",
        closed_by_name: "Budi",
        closed_at: "2026-08-29T10:00:00.000Z",
      },
      "en",
    );
    expect(subject).toContain("Main Store");
    expect(subject).toContain("Budi");
    expect(subject).toContain("Shift Recap");
  });

  it("highlights shortage variance in HTML", () => {
    const html = buildShiftRecapEmailHtml({
      orgName: "Acme Org",
      language: "id",
      detail: {
        outlet_name: "Outlet A",
        opened_by_name: "Kasir 1",
        closed_by_name: "Kasir 1",
        opening_cash: 100_000,
        cash_sales: 50_000,
        expected_cash: 150_000,
        closing_cash: 146_000,
        cash_difference: -4000,
        products_sold_qty: 12,
        payment_methods: [{ payment_method: "cash", total_collected: 50_000 }],
      },
    });

    expect(html).toContain("Rekap Shift");
    expect(html).toContain("(Rp. 4.000)");
    expect(html).toContain("color:#dc2626;");
    expect(html).toContain("Tunai");
  });
});
