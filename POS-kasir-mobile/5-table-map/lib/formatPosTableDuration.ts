/** Format seated duration for POS table map / cashier. Supports days. */
export function formatPosTableDuration(seatedAtIso: string, nowMs: number = Date.now()): string {
  const start = new Date(seatedAtIso).getTime();
  if (!Number.isFinite(start)) return "0m";
  const mins = Math.max(0, Math.floor((nowMs - start) / 60_000));
  if (mins < 60) return `${mins}m`;
  const days = Math.floor(mins / (60 * 24));
  const remAfterDays = mins % (60 * 24);
  const h = Math.floor(remAfterDays / 60);
  const m = remAfterDays % 60;
  if (days > 0) {
    const parts = [`${days}d`];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(" ");
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
