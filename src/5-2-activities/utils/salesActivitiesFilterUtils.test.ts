import { describe, expect, it } from 'vitest';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import {
  DEFAULT_SALES_ACTIVITIES_FILTERS,
  filterSalesActivities,
  getSalesActivityDateRange,
  matchesSalesActivityDateFilter,
} from './salesActivitiesFilterUtils';

function activity(partial: Partial<SalesActivity> & Record<string, unknown>): SalesActivity {
  return {
    id: '1',
    client_name: 'Acme',
    activity_type: 'Demo',
    status: 'Active',
    payment_method: 'cash',
    total_amount: 0,
    ...partial,
  } as SalesActivity;
}

describe('salesActivitiesFilterUtils', () => {
  it('filters by status and type using DB/form values (case-insensitive)', () => {
    const rows = [
      activity({ id: '1', status: 'Active', activity_type: 'Demo' }),
      activity({ id: '2', status: 'Won', activity_type: 'Lead Conversion' }),
    ];
    const byStatus = filterSalesActivities(rows, { ...DEFAULT_SALES_ACTIVITIES_FILTERS, status: 'Won' });
    expect(byStatus).toHaveLength(1);
    expect(byStatus[0].id).toBe('2');

    const byType = filterSalesActivities(rows, {
      ...DEFAULT_SALES_ACTIVITIES_FILTERS,
      type: 'Lead Conversion',
    });
    expect(byType).toHaveLength(1);
  });

  it('filters by payment method', () => {
    const rows = [
      activity({ id: '1', payment_method: 'bank_transfer' }),
      activity({ id: '2', payment_method: 'cash' }),
    ];
    const filtered = filterSalesActivities(rows, {
      ...DEFAULT_SALES_ACTIVITIES_FILTERS,
      payment: 'bank_transfer',
    });
    expect(filtered.map((r) => r.id)).toEqual(['1']);
  });

  it('filters by activity date for today', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const rows = [activity({ id: '1', date: dateStr }), activity({ id: '2', date: '2020-01-01' })];
    const filtered = filterSalesActivities(rows, {
      ...DEFAULT_SALES_ACTIVITIES_FILTERS,
      date: 'today',
    });
    expect(filtered.map((r) => r.id)).toEqual(['1']);
    expect(matchesSalesActivityDateFilter(rows[0], 'today')).toBe(true);
    expect(matchesSalesActivityDateFilter(rows[1], 'today')).toBe(false);
  });

  it('last_3_months range spans three calendar months from month start', () => {
    const range = getSalesActivityDateRange('last_3_months');
    expect(range).not.toBeNull();
    const start = range!.start;
    const end = range!.endExclusive;
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
