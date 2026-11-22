import { describe, expect, it } from 'vitest';
import { jakartaWeekRange, planMatchesContentDatePreset } from './contentDateFilter';

const sundayMorningJakarta = new Date('2026-11-22T03:00:00Z');

describe('content date presets', () => {
  it('uses Monday as the start of this week in Jakarta', () => {
    expect(jakartaWeekRange('2026-11-22')).toEqual({
      start: '2026-11-16',
      end: '2026-11-22',
    });
  });

  it('matches today, yesterday, and this week, and skips an empty post date', () => {
    expect(planMatchesContentDatePreset('2026-11-22', 'today', sundayMorningJakarta)).toBe(true);
    expect(planMatchesContentDatePreset('2026-11-21', 'today', sundayMorningJakarta)).toBe(false);
    expect(planMatchesContentDatePreset('2026-11-21', 'yesterday', sundayMorningJakarta)).toBe(true);
    expect(planMatchesContentDatePreset('2026-11-16', 'this_week', sundayMorningJakarta)).toBe(true);
    expect(planMatchesContentDatePreset('2026-11-15', 'this_week', sundayMorningJakarta)).toBe(false);
    expect(planMatchesContentDatePreset(null, 'today', sundayMorningJakarta)).toBe(false);
  });
});
