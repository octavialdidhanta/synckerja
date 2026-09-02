import { describe, expect, it } from 'vitest';
import { buildDailyTaskCacheKey, getPlanDateQueryBounds } from './getPlanDateQueryBounds';

describe('getPlanDateQueryBounds', () => {
  const now = new Date(2026, 7, 15);

  it('returns this month bounds for this_month_plan', () => {
    expect(getPlanDateQueryBounds('this_month_plan', undefined, now)).toEqual({
      start: '2026-08-01',
      end: '2026-09-01',
    });
  });

  it('returns next and last month bounds', () => {
    expect(getPlanDateQueryBounds('next_month_plan', undefined, now)).toEqual({
      start: '2026-09-01',
      end: '2026-10-01',
    });
    expect(getPlanDateQueryBounds('last_month_plan', undefined, now)).toEqual({
      start: '2026-07-01',
      end: '2026-08-01',
    });
  });

  it('returns null for all-dates and custom without a month', () => {
    expect(getPlanDateQueryBounds(undefined, undefined, now)).toBeNull();
    expect(getPlanDateQueryBounds('custom_month_plan', undefined, now)).toBeNull();
  });

  it('uses custom plan month when provided', () => {
    expect(getPlanDateQueryBounds('custom_month_plan', '2026-03-01', now)).toEqual({
      start: '2026-03-01',
      end: '2026-04-01',
    });
  });
});

describe('buildDailyTaskCacheKey', () => {
  it('namespaces cache by plan filter so this-month and all-dates stay separate', () => {
    expect(buildDailyTaskCacheKey('org', 'user', 'this_month_plan')).toBe(
      'tasks_org_user_this_month_plan_',
    );
    expect(buildDailyTaskCacheKey('org', 'user')).toBe('tasks_org_user_all_');
  });
});
