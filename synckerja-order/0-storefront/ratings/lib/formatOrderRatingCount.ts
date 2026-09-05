/** Compact count for GoFood-style badge: 12, 99, 100+. */
export function formatOrderRatingCount(count: number): string {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n >= 100) return "100+";
  return String(n);
}

/** Display average with one decimal (e.g. 4.8). */
export function formatOrderAvgRating(avg: number): string {
  if (!Number.isFinite(avg)) return "0.0";
  return (Math.round(avg * 10) / 10).toFixed(1);
}
