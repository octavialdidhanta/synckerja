/** Digital marketing report: Meta metrics display currency (matches edge functions). */
export const META_ADS_REPORT_CURRENCY = "IDR";

export function normalizeMetaAdsReportCurrency(
  accountCurrency?: string | null,
): string {
  void accountCurrency;
  return META_ADS_REPORT_CURRENCY;
}
