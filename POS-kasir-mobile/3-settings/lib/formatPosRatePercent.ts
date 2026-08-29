/**
 * Format catalog rate percent for POS settings list.
 * id → "2,5 %"; en → "2.5 %"
 */
export function formatPosRatePercent(amount: number, locale: string = "id"): string {
  const rounded = Math.round(amount * 100) / 100;
  const useId = locale === "id" || locale.startsWith("id");
  if (Number.isInteger(rounded)) {
    return `${rounded} %`;
  }
  const raw = rounded.toFixed(2).replace(/\.?0+$/, "");
  const display = useId ? raw.replace(".", ",") : raw;
  return `${display} %`;
}
