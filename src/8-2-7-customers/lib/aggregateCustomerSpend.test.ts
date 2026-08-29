import { describe, expect, it } from 'vitest';
import {
  aggregateCustomerSpend,
  monthRangeYmd,
  resolveCustomerSince,
  yearRangeYmd,
} from './aggregateCustomerSpend';

describe('aggregateCustomerSpend', () => {
  const anchor = new Date(2026, 7, 17); // 17 Aug 2026 local

  it('sums lifetime, month, and year spend per lead', () => {
    const map = aggregateCustomerSpend(
      [
        { lead_id: 'a', date: '2026-08-17', total_amount: 36000 },
        { lead_id: 'a', date: '2026-01-10', total_amount: 10000 },
        { lead_id: 'b', date: '2025-12-01', total_amount: 5000 },
      ],
      anchor,
    );

    expect(map.get('a')).toEqual({
      thisMonth: 36000,
      thisYear: 46000,
      lifetime: 46000,
      firstPurchaseDate: '2026-01-10',
    });
    expect(map.get('b')).toEqual({
      thisMonth: 0,
      thisYear: 0,
      lifetime: 5000,
      firstPurchaseDate: '2025-12-01',
    });
  });

  it('resolveCustomerSince prefers converted_at', () => {
    expect(
      resolveCustomerSince({
        convertedAt: '2026-08-17T10:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        firstPurchaseDate: '2026-08-01',
      }),
    ).toMatch(/2026-08-1[67]/);
  });

  it('resolveCustomerSince falls back to first purchase then created_at', () => {
    expect(
      resolveCustomerSince({
        convertedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        firstPurchaseDate: '2026-08-01',
      }),
    ).toBe('2026-08-01');
  });
});

describe('monthRangeYmd / yearRangeYmd', () => {
  it('returns local month boundaries', () => {
    const anchor = new Date(2026, 7, 17);
    expect(monthRangeYmd(anchor)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(yearRangeYmd(anchor)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});
