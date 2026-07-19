import { describe, expect, it } from 'vitest';

/** Mirror of edge Basic Auth helper for vitest (no Deno). */
function buildBlibliBasicAuthHeader(clientId: string, clientKey: string): string {
  const raw = `${clientId}:${clientKey}`;
  return `Basic ${btoa(raw)}`;
}

function countEventsInWindow(createdAtIsoList: string[], nowMs: number, windowMs = 3_600_000): number {
  const cutoff = nowMs - windowMs;
  let n = 0;
  for (const iso of createdAtIsoList) {
    const t = Date.parse(iso);
    if (!Number.isNaN(t) && t >= cutoff) n += 1;
  }
  return n;
}

describe('blibliSeller edge helpers (vitest mirrors)', () => {
  it('encodes Basic auth', () => {
    expect(buildBlibliBasicAuthHeader('id', 'key')).toBe(`Basic ${btoa('id:key')}`);
  });

  it('counts mints in 1h window', () => {
    const now = Date.parse('2026-07-18T12:00:00.000Z');
    expect(
      countEventsInWindow(
        ['2026-07-18T11:10:00.000Z', '2026-07-18T10:50:00.000Z'],
        now,
      ),
    ).toBe(1);
  });
});
