export type MetaMetricValueKind = "currency" | "percent" | "count" | "decimal" | "text";

export type MetaCtrValueSource = "api" | "computed";

/** Meta Insights CTR is already a percent, including values under 1. */
export function formatMetaCtr(
  value: unknown,
  source: MetaCtrValueSource,
): string {
  const n = parseMetricNumber(value);
  if (n == null || !Number.isFinite(n)) return "—";
  const pct = source === "computed" ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

export function formatMetaMetricValue(
  key: string,
  value: unknown,
  currencyCode: string | null | undefined,
  options?: { ctrSource?: MetaCtrValueSource },
): string {
  if (key === "delivery") {
    const label = String(value ?? "").trim();
    if (label === "Active" || label === "Off") return label;
    return "—";
  }

  const n = parseMetricNumber(value);
  if (n == null || !Number.isFinite(n)) return "—";

  const kind = inferMetaKind(key);

  if (kind === "percent") {
    if (key === "ctr") {
      return formatMetaCtr(n, options?.ctrSource ?? "api");
    }
    return `${n.toFixed(2)}%`;
  }

  if (kind === "currency") {
    const code = (currencyCode ?? "USD").toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        maximumFractionDigits: code === "IDR" ? 0 : 2,
      }).format(n);
    } catch {
      return `${code} ${n.toFixed(2)}`;
    }
  }

  if (kind === "decimal") {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
  }

  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export function parseMetricNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function inferMetaKind(key: string): MetaMetricValueKind {
  if (key === "delivery") return "text";
  if (
    key === "spend" ||
    key === "cpc" ||
    key === "cpm" ||
    key === "budget" ||
    key === "leads_cost_per_lead" ||
    key === "cost_per_atc" ||
    key === "cost_per_purchase" ||
    key === "atc_conversion_value" ||
    key === "purchase_conversion_value" ||
    key === "aov"
  ) {
    return "currency";
  }
  if (
    key === "ctr" ||
    key === "traffic_visit_click_rate" ||
    key === "leads_visit_rate" ||
    key === "click_to_view_rate" ||
    key === "view_to_atc_rate" ||
    key === "atc_to_purchase_rate"
  ) {
    return "percent";
  }
  if (
    key === "impressions" ||
    key === "clicks" ||
    key === "reach" ||
    key === "traffic_total_visit_page" ||
    key === "leads_total" ||
    key === "content_views" ||
    key === "adds_to_cart" ||
    key === "purchases"
  ) {
    return "count";
  }
  return "decimal";
}

export function formatMetaDeliveryCell(
  value: unknown,
  labels: { active: string; off: string; learning?: string; learningLimited?: string },
): string {
  const label = String(value ?? "").trim();
  if (label === "Active") return labels.active;
  if (label === "Off") return labels.off;
  if (label === "Learning") return labels.learning ?? label;
  if (label === "Learning limited") return labels.learningLimited ?? label;
  return "—";
}

export function formatMetaBudgetCell(args: {
  budget: unknown;
  usesCampaignBudget: boolean;
  currencyCode: string | null | undefined;
  usesCampaignLabel: string;
}): string {
  if (args.usesCampaignBudget && (args.budget == null || args.budget === "")) {
    return args.usesCampaignLabel;
  }
  return formatMetaMetricValue("budget", args.budget, args.currencyCode);
}

export function computeSummaryCtr(clicks: number, impressions: number): number | null {
  if (impressions <= 0) return null;
  return clicks / impressions;
}

export function computeSummaryCpc(spend: number, clicks: number): number | null {
  if (clicks <= 0 || !Number.isFinite(spend)) return null;
  return spend / clicks;
}
