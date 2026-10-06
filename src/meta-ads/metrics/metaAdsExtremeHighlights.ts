import { parseMetricNumber } from "@/meta-ads/metrics/formatMetaMetricValue";

type Bounds = { min: number; max: number };

const HIGHER_IS_BETTER = [
  "ctr",
  "view_to_atc_rate",
  "atc_conversion_value",
  "atc_to_purchase_rate",
  "purchase_roas",
] as const;
const LOWER_IS_BETTER = ["cpm", "cost_per_purchase"] as const;
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

/**
 * CTR, % View to ATC, ATC conversion value, % ATC to Purchase, and Purchase ROAS get greener as they rise.
 * CPM and Cost/Purchase get greener as they fall.
 * Each number is tinted by its place between the lowest and highest value, including the middle.
 */
export function metaAdsExtremeCellStyle(
  key: string,
  value: unknown,
  bounds: MetaAdsExtremeBounds,
): MetaAdsExtremeCellStyle | null {
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
  const ink = luminance(rgb) < 0.5 ? "#ffffff" : towardBest ? "#052e16" : "#450a0a";
  return {
    backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
    color: ink,
  };
}
