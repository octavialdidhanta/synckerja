import { describe, expect, it } from 'vitest';
import { calculateOnTimeStatus, calendarDayYmd } from './onTimeStatus';

describe('calendarDayYmd', () => {
  it('keeps date-only strings', () => {
    expect(calendarDayYmd('2026-11-15')).toBe('2026-11-15');
  });

  it('maps midnight WIB (17:00 UTC prior day) to Jakarta calendar day', () => {
    expect(calendarDayYmd('2026-11-14T17:00:00.000Z')).toBe('2026-11-15');
    expect(calendarDayYmd('2026-11-14 17:00:00+00')).toBe('2026-11-15');
  });
});

describe('calculateOnTimeStatus', () => {
  it('is Ontime when actual matches planned Jakarta day', () => {
    expect(calculateOnTimeStatus('2026-11-15', '2026-11-14T17:00:00.000Z')).toBe('Ontime');
  });

  it('counts Late by Jakarta calendar days', () => {
    expect(calculateOnTimeStatus('2026-11-16', '2026-11-14T17:00:00.000Z')).toBe('Late 1 Day');
    expect(calculateOnTimeStatus('2026-11-17', '2026-11-14T17:00:00.000Z')).toBe('Late 2 Days');
  });

  it('is Ontime when actual is before planned day', () => {
    expect(calculateOnTimeStatus('2026-11-14', '2026-11-14T17:00:00.000Z')).toBe('Ontime');
  });
});
