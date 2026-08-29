import { describe, expect, it } from "vitest";
import { computePosActivityDisplayTotals } from "./computePosActivityDisplayTotals";

describe("computePosActivityDisplayTotals", () => {
  it("adds tax and gratuity for application_method add", () => {
    const t = computePosActivityDisplayTotals({
      checkout_subtotal: 30000,
      checkout_tax_amount: 3300,
      checkout_gratuity_amount: 0,
      total_amount: 30000,
      total_paid_amount: 30000,
      payment_method: "cash",
      cash_tendered: 35000,
      application_method: "add",
    });
    expect(t.displayTotal).toBe(33300);
    expect(t.showTax).toBe(true);
    expect(t.showTendered).toBe(true);
    expect(t.tendered).toBe(35000);
    expect(t.change).toBe(1700);
    expect(t.showPaid).toBe(false);
  });

  it("keeps total = subtotal for include mode", () => {
    const t = computePosActivityDisplayTotals({
      checkout_subtotal: 30000,
      checkout_tax_amount: 3300,
      checkout_gratuity_amount: 0,
      total_amount: 30000,
      total_paid_amount: 30000,
      payment_method: "e_wallet",
      cash_tendered: null,
      application_method: "include",
    });
    expect(t.displayTotal).toBe(30000);
    expect(t.taxIncluded).toBe(true);
    expect(t.showPaid).toBe(true);
    expect(t.showChange).toBe(false);
  });

  it("shows paid row for bank transfer without change", () => {
    const t = computePosActivityDisplayTotals({
      checkout_subtotal: 10000,
      checkout_tax_amount: 1100,
      checkout_gratuity_amount: 500,
      total_amount: 10000,
      total_paid_amount: 10000,
      payment_method: "bank_transfer",
      cash_tendered: null,
      application_method: "add",
    });
    expect(t.displayTotal).toBe(11600);
    expect(t.showPaid).toBe(true);
    expect(t.showTendered).toBe(false);
    expect(t.showChange).toBe(false);
  });

  it("hides cash tendered when null", () => {
    const t = computePosActivityDisplayTotals({
      checkout_subtotal: 10000,
      checkout_tax_amount: 0,
      checkout_gratuity_amount: 0,
      total_amount: 10000,
      total_paid_amount: 10000,
      payment_method: "cash",
      cash_tendered: null,
      application_method: "add",
    });
    expect(t.showTendered).toBe(false);
    expect(t.showChange).toBe(false);
    expect(t.showPaid).toBe(false);
  });
});
