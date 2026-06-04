/**
 * Google Ads API returns rate/fraction metrics as 0–1 (e.g. 0.1122 = 11.22%).
 * Align with normalizeApiFractionMetric in supabase/functions/_shared/googleAdsMetricsCatalog.ts
 */
export function normalizeGoogleAdsFractionMetric(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  if (value <= 1) return value;
  if (value <= 100) return value / 100;
  let v = value;
  for (let i = 0; i < 4 && v > 1; i++) v /= 100;
  return v <= 1 ? v : null;
}

export function fractionMetricToPercent(value: number, key: string): number {
  if (key.endsWith("_percent")) {
    const frac = normalizeGoogleAdsFractionMetric(value);
    return (frac ?? value / 100) * 100;
  }
  const frac = normalizeGoogleAdsFractionMetric(value);
  if (frac == null) return Number.NaN;
  return frac * 100;
}
