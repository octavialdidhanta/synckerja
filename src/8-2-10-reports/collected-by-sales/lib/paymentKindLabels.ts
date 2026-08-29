import type { CollectedByPaymentKind } from "./collectedBySalesTypes";

export const PAYMENT_KIND_I18N: Record<
  CollectedByPaymentKind,
  { key: string; fallback: string }
> = {
  cash: { key: "reports.collectedBySales.paymentKind.cash", fallback: "Cash" },
  non_cash: {
    key: "reports.collectedBySales.paymentKind.nonCash",
    fallback: "Non-Cash",
  },
};

export function parsePaymentKind(value: unknown): CollectedByPaymentKind {
  return String(value ?? "") === "cash" ? "cash" : "non_cash";
}
