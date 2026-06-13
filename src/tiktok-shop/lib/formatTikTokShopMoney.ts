const DEFAULT_CURRENCY = "IDR";
const LOCALE = "id-ID";

export function formatTikTokShopMoney(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (value == null || !Number.isFinite(value)) return "—";

  const code = (currency?.trim() || DEFAULT_CURRENCY).toUpperCase();
  const idrStyle = code === "IDR";

  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: code,
      minimumFractionDigits: idrStyle ? 0 : undefined,
      maximumFractionDigits: idrStyle ? 0 : 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat(LOCALE, {
      maximumFractionDigits: idrStyle ? 0 : 2,
    }).format(value);
  }
}
