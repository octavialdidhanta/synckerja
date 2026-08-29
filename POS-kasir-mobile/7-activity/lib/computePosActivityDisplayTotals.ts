import type { PosActivityPaymentMethod } from "./posActivityTypes";

export type PosActivityApplicationMethod = "add" | "include";

export type PosActivityDisplayTotalsInput = {
  checkout_subtotal: number | null;
  checkout_tax_amount: number | null;
  checkout_gratuity_amount: number | null;
  total_amount: number;
  total_paid_amount: number;
  payment_method: PosActivityPaymentMethod | null;
  cash_tendered: number | null;
  application_method: PosActivityApplicationMethod;
};

export type PosActivityDisplayTotals = {
  subtotal: number | null;
  taxAmount: number;
  gratuityAmount: number;
  displayTotal: number;
  showTax: boolean;
  showGratuity: boolean;
  taxIncluded: boolean;
  /** Cash tendered row */
  showTendered: boolean;
  tendered: number | null;
  /** Cash change row */
  showChange: boolean;
  change: number | null;
  /** Non-cash: paid-in-full row */
  showPaid: boolean;
};

function n(value: number | null | undefined): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? Math.round(x) : 0;
}

/**
 * Display totals for Activity detail (corrects clobbered total_amount for store checkout).
 */
export function computePosActivityDisplayTotals(
  input: PosActivityDisplayTotalsInput,
): PosActivityDisplayTotals {
  const subtotal =
    input.checkout_subtotal == null ? null : n(input.checkout_subtotal);
  const taxAmount = n(input.checkout_tax_amount);
  const gratuityAmount = n(input.checkout_gratuity_amount);
  const hasCheckoutBreakdown = input.checkout_subtotal != null;
  const taxIncluded = input.application_method === "include";

  let displayTotal: number;
  if (hasCheckoutBreakdown) {
    if (taxIncluded) {
      displayTotal = n(subtotal);
    } else {
      displayTotal = n(subtotal) + taxAmount + gratuityAmount;
    }
  } else {
    displayTotal = n(input.total_paid_amount || input.total_amount);
  }

  const method = (input.payment_method ?? "").toLowerCase();
  const isCash = method === "cash";
  const tendered =
    input.cash_tendered == null ? null : n(input.cash_tendered);

  const showTendered = isCash && tendered != null;
  const change =
    showTendered && tendered != null
      ? Math.max(0, tendered - displayTotal)
      : null;
  const showChange = showTendered && change != null;
  const showPaid = !isCash && displayTotal > 0;

  return {
    subtotal,
    taxAmount,
    gratuityAmount,
    displayTotal,
    showTax: taxAmount > 0,
    showGratuity: gratuityAmount > 0,
    taxIncluded,
    showTendered,
    tendered,
    showChange,
    change,
    showPaid,
  };
}
