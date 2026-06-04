import type { MetricValueKind } from "@/google-ads/metrics/types";
import { fractionMetricToPercent } from "@/google-ads/metrics/fractionMetricToPercent";

export function formatMetricValue(  key: string,
  value: number | null | undefined,
  currencyCode: string | null | undefined,
  valueKind?: MetricValueKind,
): string {
  if (value == null || !Number.isFinite(value)) return "—";

  const kind = valueKind ?? inferKind(key);

  if (
    kind === "rate" ||
    kind === "fraction" ||
    key === "ctr" ||
    key.endsWith("_rate") ||
    key.endsWith("_share") ||
    key.endsWith("_pct") ||
    key.endsWith("_percentage")
  ) {
    const pct = fractionMetricToPercent(value, key);
    if (!Number.isFinite(pct)) return "—";
    return `${pct.toFixed(2)}%`;
  }

  if (kind === "micros" || key === "spent" || key.startsWith("avg_") || key.includes("cost")) {
    const code = (currencyCode ?? "IDR").toUpperCase();
    if (code === "IDR") {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(value);
    }
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ${code}`;
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function inferKind(key: string): MetricValueKind {
  if (key === "spent" || key.startsWith("avg_") || key.includes("cost")) return "micros";
  if (key.endsWith("_share") || key.endsWith("_pct") || key.endsWith("_percentage")) {
    return "fraction";
  }
  if (key === "ctr" || key.endsWith("_rate")) return "rate";
  return "count";
}
