import { describe, expect, it } from 'vitest';

/** Mirror of edge order rate-limit helpers for vitest. */
const LIMIT = 100;
const WINDOW_MS = 30 * 60 * 1000;

function countEventsInWindow(createdAtIsoList: string[], nowMs: number, windowMs = WINDOW_MS): number {
  const cutoff = nowMs - windowMs;
  let n = 0;
  for (const iso of createdAtIsoList) {
    const t = Date.parse(iso);
    if (!Number.isNaN(t) && t >= cutoff) n += 1;
  }
  return n;
}

function isRateLimited(count: number, limit = LIMIT): boolean {
  return count >= limit;
}

describe('blibli order rate limit (vitest mirror)', () => {
  it('counts only events inside 30 minutes', () => {
    const now = Date.parse('2026-07-19T12:00:00.000Z');
    expect(
      countEventsInWindow(
        ['2026-07-19T11:45:00.000Z', '2026-07-19T11:40:00.000Z', '2026-07-19T11:00:00.000Z'],
        now,
      ),
    ).toBe(2);
  });

  it('blocks at 100', () => {
    expect(isRateLimited(99)).toBe(false);
    expect(isRateLimited(100)).toBe(true);
  });
});
