export function formatReceiptPaymentLabel(
  method: string | null | undefined,
  paymentReference?: string | null,
): string {
  const m = String(method ?? "").toLowerCase();
  if (m === "cash") return "TUNAI";
  if (m === "bank_transfer") return "TRANSFER";
  if (m === "e_wallet" || m === "ewallet") {
    const ref = String(paymentReference ?? "").trim();
    return ref ? ref.toUpperCase() : "E-WALLET";
  }
  return m ? m.toUpperCase() : "—";
}
