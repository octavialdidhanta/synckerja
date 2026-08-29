/** Format Rupiah for email HTML (id-ID). */
export function formatReceiptMoney(amount: number | null | undefined): string {
  const n = Math.round(Number(amount ?? 0));
  return `Rp ${n.toLocaleString("id-ID")}`;
}
