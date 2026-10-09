import { parseMetricNumber } from "@/meta-ads/metrics/formatMetaMetricValue";

type Bounds = { min: number; max: number };

const HIGHER_IS_BETTER = ["atc_conversion_value"] as const;
const LOWER_IS_BETTER = [] as const;
type HighlightKey = (typeof HIGHER_IS_BETTER)[number] | (typeof LOWER_IS_BETTER)[number];

export type MetaAdsExtremeBounds = Record<HighlightKey, Bounds | null>;

function isHighlightKey(key: string): key is HighlightKey {
  return (
    (HIGHER_IS_BETTER as readonly string[]).includes(key) ||
    (LOWER_IS_BETTER as readonly string[]).includes(key)
  );
}

export type MetaAdsExtremeCellStyle = {
  backgroundColor: string;
  color: string;
};

const GREEN = [22, 163, 74] as const;
const RED = [220, 38, 38] as const;
/** Lightest tint, used at the midpoint so a middle number still shows its side. */
const MIN_VISIBLE = 0.34;

function metricBounds(rows: readonly Record<string, unknown>[], key: HighlightKey): Bounds | null {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const row of rows) {
    const value = parseMetricNumber(row[key]);
    if (value == null) continue;
    count += 1;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (count < 2 || min === max) return null;
  return { min, max };
}

/** Extremes across the current filtered rows. A single distinct value is left uncolored. */
export function metaAdsExtremeBounds(rows: readonly Record<string, unknown>[]): MetaAdsExtremeBounds {
  const keys = [...HIGHER_IS_BETTER, ...LOWER_IS_BETTER];
  return Object.fromEntries(keys.map((key) => [key, metricBounds(rows, key)])) as MetaAdsExtremeBounds;
}

/** 1 is the best end of the column, 0 is the worst end. */
function goodness(key: HighlightKey, value: number, range: Bounds): number {
  const span = range.max - range.min;
  if (span === 0) return 1;
  const position = (value - range.min) / span;
  return (HIGHER_IS_BETTER as readonly string[]).includes(key) ? position : 1 - position;
}

function mixToward(target: readonly [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(255 + (target[0] - 255) * amount),
    Math.round(255 + (target[1] - 255) * amount),
    Math.round(255 + (target[2] - 255) * amount),
  ];
}

function luminance(rgb: [number, number, number]): number {
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
}

export type MetaAdsExtremeCellOptions = {
  /** Purchase ROAS at or above this value is green. Below it is red. */
  purchaseRoasThreshold?: number;
  /** When false, Purchase ROAS stays uncolored. */
  purchaseRoasColorEnabled?: boolean;
  /** Cost per purchase at or below this value is green. Above it is red. */
  costPerPurchaseThreshold?: number;
  /** When false, Cost/Purchase stays uncolored. */
  costPerPurchaseColorEnabled?: boolean;
  /** % ATC to Purchase at or above this percent is green. Below it is red. */
  atcToPurchaseThreshold?: number;
  /** When false, % ATC to Purchase stays uncolored. */
  atcToPurchaseColorEnabled?: boolean;
  /** AOV at or above this amount is green. Below it is red. */
  aovThreshold?: number;
  /** When false, AOV stays uncolored. */
  aovColorEnabled?: boolean;
  /** % View to ATC at or above this percent is green. Below it is red. */
  viewToAtcThreshold?: number;
  /** When false, % View to ATC stays uncolored. */
  viewToAtcColorEnabled?: boolean;
  /** CTR at or above this percent is green. Below it is red. */
  ctrThreshold?: number;
  /** When false, CTR stays uncolored. */
  ctrColorEnabled?: boolean;
  /** CPM at or below this amount is green. Above it is red. */
  cpmThreshold?: number;
  /** When false, CPM stays uncolored. */
  cpmColorEnabled?: boolean;
};

/**
 * ATC conversion value gets greener as it rises, tinted by its place between the lowest and highest value.
 * CTR, Purchase ROAS, % View to ATC, % ATC to Purchase, AOV, CPM, and Cost/Purchase use a fixed threshold.
 * A higher CTR, ROAS, view-to-ATC rate, ATC-to-purchase rate, or AOV is better. A lower CPM or cost per purchase is better.
 */
export function metaAdsExtremeCellStyle(
  key: string,
  value: unknown,
  bounds: MetaAdsExtremeBounds,
  options?: MetaAdsExtremeCellOptions,
): MetaAdsExtremeCellStyle | null {
  if (key === "purchase_roas") {
    if (options?.purchaseRoasColorEnabled === false) return null;
    return higherIsBetterThresholdStyle(value, options?.purchaseRoasThreshold, 10);
  }
  if (key === "ctr") {
    if (options?.ctrColorEnabled === false) return null;
    return higherIsBetterThresholdStyle(value, options?.ctrThreshold, 1);
  }
  if (key === "view_to_atc_rate") {
    if (options?.viewToAtcColorEnabled === false) return null;
    return higherIsBetterThresholdStyle(value, options?.viewToAtcThreshold, 10);
  }
  if (key === "atc_to_purchase_rate") {
    if (options?.atcToPurchaseColorEnabled === false) return null;
    return higherIsBetterThresholdStyle(value, options?.atcToPurchaseThreshold, 20);
  }
  if (key === "aov") {
    if (options?.aovColorEnabled === false) return null;
    return higherIsBetterThresholdStyle(value, options?.aovThreshold, 150000);
  }
  if (key === "cost_per_purchase") {
    if (options?.costPerPurchaseColorEnabled === false) return null;
    return lowerIsBetterThresholdStyle(value, options?.costPerPurchaseThreshold, 50000);
  }
  if (key === "cpm") {
    if (options?.cpmColorEnabled === false) return null;
    return lowerIsBetterThresholdStyle(value, options?.cpmThreshold, 10000);
  }
  if (!isHighlightKey(key)) return null;
  const range = bounds[key];
  if (!range) return null;
  const n = parseMetricNumber(value);
  if (n == null) return null;

  const score = goodness(key, n, range);
  const towardBest = score >= 0.5;
  const distance = towardBest ? (score - 0.5) * 2 : (0.5 - score) * 2;
  const amount = MIN_VISIBLE + (1 - MIN_VISIBLE) * distance;

  const rgb = mixToward(towardBest ? GREEN : RED, amount);
  return tintedCell(rgb, towardBest);
}

function tintedCell(rgb: [number, number, number], towardBest: boolean): MetaAdsExtremeCellStyle {
  const ink = luminance(rgb) < 0.5 ? "#ffffff" : towardBest ? "#052e16" : "#450a0a";
  return {
    backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
    color: ink,
  };
}

/** 0 is the darkest red. The threshold is the lightest green. Twice the threshold is solid green. */
function higherIsBetterThresholdStyle(
  value: unknown,
  threshold: number | undefined,
  fallback: number,
): MetaAdsExtremeCellStyle | null {
  const n = parseMetricNumber(value);
  const cut = threshold != null && threshold > 0 ? threshold : fallback;
  if (n == null) return null;

  if (n >= cut) {
    const distance = Math.min(1, (n - cut) / cut);
    const amount = MIN_VISIBLE + (1 - MIN_VISIBLE) * distance;
    return tintedCell(mixToward(GREEN, amount), true);
  }

  const distance = Math.min(1, Math.max(0, (cut - n) / cut));
  const amount = MIN_VISIBLE + (1 - MIN_VISIBLE) * distance;
  return tintedCell(mixToward(RED, amount), false);
}

/** 0 is the darkest green. The threshold is the lightest green. Twice the threshold is solid red. */
function lowerIsBetterThresholdStyle(
  value: unknown,
  threshold: number | undefined,
  fallback: number,
): MetaAdsExtremeCellStyle | null {
  const n = parseMetricNumber(value);
  const cut = threshold != null && threshold > 0 ? threshold : fallback;
  if (n == null) return null;

  if (n <= cut) {
    const distance = Math.min(1, Math.max(0, (cut - n) / cut));
    const amount = MIN_VISIBLE + (1 - MIN_VISIBLE) * distance;
    return tintedCell(mixToward(GREEN, amount), true);
  }

  const distance = Math.min(1, (n - cut) / cut);
  const amount = MIN_VISIBLE + (1 - MIN_VISIBLE) * distance;
  return tintedCell(mixToward(RED, amount), false);
}
