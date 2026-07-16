/** Digital marketing report UI always displays amounts in IDR (no USD placeholders). */
export const DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY = "IDR";

export function normalizeReportDisplayCurrency(
  accountCurrency?: string | null,
): string {
  void accountCurrency;
  return DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY;
}
