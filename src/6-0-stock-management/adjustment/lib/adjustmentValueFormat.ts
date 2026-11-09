const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** "Rp380.000" for a positive amount. */
export function formatRupiahAmount(amount: number): string {
  return `Rp${rupiah.format(Math.round(Math.abs(amount)))}`;
}

/** Signed rupiah for an adjustment value: "−Rp380.000" (expense), "+Rp12.000" (income), "Rp0". */
export function formatSignedRupiah(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "Rp0";
  return `${rounded < 0 ? "−" : "+"}${formatRupiahAmount(rounded)}`;
}
