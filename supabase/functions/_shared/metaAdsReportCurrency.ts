/** Digital marketing report & charts: Meta amounts are shown in IDR (Indonesia). */
export const META_ADS_REPORT_CURRENCY = "IDR";

/**
 * Meta Insights often returns `account_currency: USD` while spend values match IDR
 * for Indonesian ad accounts. Report UI always labels Meta metrics as IDR.
 */
export function metaAdsReportCurrency(
  _accountCurrency?: string | null,
): string {
  return META_ADS_REPORT_CURRENCY;
}
