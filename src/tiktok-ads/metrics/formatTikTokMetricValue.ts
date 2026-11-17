export type TikTokMetricValueKind = "currency" | "percent" | "count" | "decimal";

export type TikTokCtrValueSource = "api" | "computed";

/** TikTok returns CTR as percent strings; summary CTR is clicks/impressions (fraction). */
export function formatTikTokCtr(
  value: unknown,
  source: TikTokCtrValueSource,
): string {
  const n = parseMetricNumber(value);
  if (n == null || !Number.isFinite(n)) return "—";
  const pct = source === "computed" ? n * 100 : n <= 1 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

export function formatTikTokMetricValue(
  key: string,
  value: unknown,
  currencyCode: string | null | undefined,
  options?: { ctrSource?: TikTokCtrValueSource },
): string {
  const n = parseMetricNumber(value);
  if (n == null || !Number.isFinite(n)) return "—";

  const kind = inferTikTokKind(key);

  if (kind === "percent") {
    if (key === "ctr") {
      return formatTikTokCtr(n, options?.ctrSource ?? "api");
    }
    return `${n.toFixed(2)}%`;
  }

  if (kind === "currency") {
    const code = tiktokAdsCurrencyCode(currencyCode) ?? (currencyCode == null || String(currencyCode).trim() === "" ? "USD" : null);
    if (!code) {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
    }
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        maximumFractionDigits: code === "IDR" ? 0 : 2,
      }).format(n);
    } catch {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: code === "IDR" ? 0 : 2 }).format(n);
    }
  }

  if (kind === "decimal") {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
  }

  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

const ISO_CURRENCY = /^[A-Z]{3}$/;

export function tiktokAdsCurrencyCode(value: unknown): string | null {
  const code = String(value ?? "").trim().toUpperCase();
  return ISO_CURRENCY.test(code) ? code : null;
}

/** TikTok account totals often return currency "-". Campaign rows carry the real code (IDR). */
export function resolveTikTokAdsCurrency(
  summaryCurrency: unknown,
  rows: ReadonlyArray<Record<string, unknown>> | null | undefined,
  fallback = "IDR",
): string {
  const fromSummary = tiktokAdsCurrencyCode(summaryCurrency);
  if (fromSummary) return fromSummary;
  for (const row of rows ?? []) {
    const code = tiktokAdsCurrencyCode(row.currency);
    if (code) return code;
  }
  return fallback;
}

export function parseMetricNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function inferTikTokKind(key: string): TikTokMetricValueKind {
  if (key === "spend" || key === "cpc" || key === "cpm") {
    return "currency";
  }
  if (key === "ctr") {
    return "percent";
  }
  if (key === "impressions" || key === "clicks" || key === "reach") {
    return "count";
  }
  return "decimal";
}

export function computeSummaryCtr(clicks: number, impressions: number): number | null {
  if (impressions <= 0) return null;
  return clicks / impressions;
}

export function computeSummaryCpc(spend: number, clicks: number): number | null {
  if (clicks <= 0 || !Number.isFinite(spend)) return null;
  return spend / clicks;
}
