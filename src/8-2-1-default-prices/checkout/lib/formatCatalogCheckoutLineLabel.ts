/** Trailing rate already baked into the catalog name, e.g. "PPN (11%)" or "Service 10%". */
const TRAILING_RATE_PERCENT =
  /\s*(?:\((?:\d+(?:[.,]\d+)?)\s*%\s*\)|(?:\d+(?:[.,]\d+)?)\s*%)\s*$/;

export function formatCatalogRatePercentCompact(
  amountPercent: number,
  locale: string = "en",
): string {
  const rounded = Math.round(amountPercent * 100) / 100;
  if (!Number.isFinite(rounded) || rounded <= 0) return "";
  if (Number.isInteger(rounded)) return `${rounded}%`;
  const raw = rounded.toFixed(2).replace(/\.?0+$/, "");
  const useId = locale === "id" || locale.startsWith("id");
  return `${useId ? raw.replace(".", ",") : raw}%`;
}

export function formatCatalogCheckoutLineLabel(args: {
  name: string;
  amountPercent?: number | null;
  locale?: string;
  includedLabel?: string | null;
}): string {
  const stripped = args.name.replace(TRAILING_RATE_PERCENT, "").trim() || args.name.trim();
  const percent = formatCatalogRatePercentCompact(args.amountPercent ?? 0, args.locale);
  const withRate = percent ? `${stripped} (${percent})` : stripped;
  if (args.includedLabel) return `${withRate} (${args.includedLabel})`;
  return withRate;
}
