/** Net amount credited to tenant ERP after platform flat fee on Xendit VA. */
export function computeVaNetAmount(grossAmount: number, platformFee: number): number {
  const gross = Number.isFinite(grossAmount) ? grossAmount : 0;
  const fee = Number.isFinite(platformFee) ? Math.max(0, Math.floor(platformFee)) : 0;
  return Math.max(0, gross - fee);
}
