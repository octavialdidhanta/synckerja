import { describe, expect, it } from 'vitest';
import {
  formatClientVisitTimeRange,
  formatClientVisitTimeValue,
  getClientVisitTimeliness,
} from './clientVisitTimeDisplay';

describe('formatClientVisitTimeValue', () => {
  it('formats plan time strings', () => {
    expect(formatClientVisitTimeValue('21:44:00')).toBe('21:44');
  });

  it('formats ISO actual timestamps to HH:mm', () => {
    expect(formatClientVisitTimeValue('2026-05-31T07:11:36.613+00:00')).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('formatClientVisitTimeRange', () => {
  it('joins start and end like plan row', () => {
    expect(formatClientVisitTimeRange('21:44:00', '13:44:00')).toBe('21:44 - 13:44');
    expect(
      formatClientVisitTimeRange(
        '2026-05-31T07:11:36.613+00:00',
        '2026-05-31T07:12:02.964+00:00',
      ),
    ).toContain(' - ');
  });
});

describe('getClientVisitTimeliness', () => {
  it('marks visit as late when actual start is after planned start', () => {
    const result = getClientVisitTimeliness({
      visit_date: '2026-05-31',
      planned_start_time: '07:00:00',
      actual_start_time: '2026-05-31T09:11:00',
      status: 'completed',
    });
    expect(result).toEqual({ kind: 'late', lateMinutes: 131 });
  });

  it('marks visit as on time when actual start is before planned start', () => {
    const result = getClientVisitTimeliness({
      visit_date: '2026-05-31',
      planned_start_time: '21:44:00',
      actual_start_time: '2026-05-31T07:11:36+00:00',
      status: 'completed',
    });
    expect(result).toEqual({ kind: 'on_time' });
  });

  it('returns pending for scheduled visits without actual start', () => {
    expect(
      getClientVisitTimeliness({
        visit_date: '2026-05-31',
        planned_start_time: '09:00:00',
        status: 'scheduled',
      }),
    ).toEqual({ kind: 'pending' });
  });
});
