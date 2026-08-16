export function formatSmpCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

export function formatSmpPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

/** Instagram/Facebook avg watch time is stored in ms; display like desktop (`11s`). */
export function formatSmpWatchTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  return `${Math.round(ms / 1000)}s`;
}
