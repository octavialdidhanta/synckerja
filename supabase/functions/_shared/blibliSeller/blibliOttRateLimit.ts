/**
 * Sliding-window counter helpers for Blibli OTT rate limit (~10 / hour / store).
 */

export const BLIBLI_OTT_RATE_WINDOW_MS = 60 * 60 * 1000;

export function countEventsInWindow(
  createdAtIsoList: string[],
  nowMs: number,
  windowMs = BLIBLI_OTT_RATE_WINDOW_MS,
): number {
  const cutoff = nowMs - windowMs;
  let n = 0;
  for (const iso of createdAtIsoList) {
    const t = Date.parse(iso);
    if (!Number.isNaN(t) && t >= cutoff) n += 1;
  }
  return n;
}

export function isBlibliOttRateLimited(
  mintCountInWindow: number,
  limitPerHour: number,
): boolean {
  return mintCountInWindow >= limitPerHour;
}

export function retryAfterSecondsForWindow(
  oldestInWindowIso: string | null | undefined,
  nowMs: number,
  windowMs = BLIBLI_OTT_RATE_WINDOW_MS,
): number {
  if (!oldestInWindowIso) return Math.ceil(windowMs / 1000);
  const oldest = Date.parse(oldestInWindowIso);
  if (Number.isNaN(oldest)) return Math.ceil(windowMs / 1000);
  const unlockAt = oldest + windowMs;
  return Math.max(1, Math.ceil((unlockAt - nowMs) / 1000));
}
