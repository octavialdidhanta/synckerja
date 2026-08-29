import type { PosCashMovement, PosShiftTotals } from "./posShiftTypes";

/** Format IDR for POS shift UI (e.g. Rp 100.000). */
export function formatPosCash(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("id-ID");
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp ${formatted}`;
}

/** Parentheses style for cash-out lines: (Rp 30.000) */
export function formatPosCashOut(amount: number): string {
  return `(${formatPosCash(Math.abs(amount))})`;
}

export function computePosShiftTotals(args: {
  openingCash: number;
  cashSales: number;
  cashRefunds?: number;
  movements: PosCashMovement[];
  productsSoldQty?: number;
}): PosShiftTotals {
  const cashIn = args.movements
    .filter((m) => m.direction === "in")
    .reduce((sum, m) => sum + m.amount, 0);
  const cashOut = args.movements
    .filter((m) => m.direction === "out")
    .reduce((sum, m) => sum + m.amount, 0);
  const cashRefunds = args.cashRefunds ?? 0;
  const expectedCash =
    args.openingCash + args.cashSales - cashRefunds + cashIn - cashOut;

  return {
    openingCash: args.openingCash,
    cashSales: args.cashSales,
    cashRefunds,
    cashIn,
    cashOut,
    cashInOutNet: cashIn - cashOut,
    expectedCash,
    productsSoldQty: args.productsSoldQty ?? 0,
  };
}
