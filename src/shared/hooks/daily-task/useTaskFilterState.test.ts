import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_DATE_RANGE,
  mergeSavedTaskFilters,
} from './useTaskFilterState';

describe('mergeSavedTaskFilters', () => {
  it('defaults date to this month plan when nothing is saved', () => {
    const filters = mergeSavedTaskFilters({});
    expect(DEFAULT_PLAN_DATE_RANGE).toBe('this_month_plan');
    expect(filters.planDateRange).toBe('this_month_plan');
    expect(filters.dateRange).toBeUndefined();
  });

  it('restores this month plan for legacy All Dates storage (omitted date keys)', () => {
    const filters = mergeSavedTaskFilters({
      search: '',
      myTask: 'all',
    });
    expect(filters.planDateRange).toBe('this_month_plan');
    expect(filters.dateRange).toBeUndefined();
  });

  it('keeps an explicit plan selection', () => {
    const filters = mergeSavedTaskFilters({
      planDateRange: 'next_month_plan',
    });
    expect(filters.planDateRange).toBe('next_month_plan');
    expect(filters.dateRange).toBeUndefined();
  });

  it('does not combine a saved due-date filter with the default plan filter', () => {
    const filters = mergeSavedTaskFilters({
      dateRange: 'today',
    });
    expect(filters.dateRange).toBe('today');
    expect(filters.planDateRange).toBeUndefined();
  });
});
