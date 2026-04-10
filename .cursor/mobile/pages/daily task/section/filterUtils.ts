import type { TaskFilters } from '@/features/8-2-DailyTask/hooks/useTaskFilters';

/**
 * Default filter values (must match useTaskFilterState defaults)
 * for the mobile subset: search, myTask, status, date/plan.
 */
const DEFAULT_SEARCH = '';
const DEFAULT_MY_TASK: 'all' | 'my_task' = 'all';
const DEFAULT_STATUS = '';
const DEFAULT_PLAN_DATE_RANGE = 'this_month_plan' as const;

/**
 * Returns true if any of the mobile-visible filters differ from default.
 * Used to show the Refresh button and filter indicator in the header.
 */
export function hasActiveFilters(filters: TaskFilters): boolean {
  if (filters.search !== DEFAULT_SEARCH) return true;
  if (filters.myTask !== DEFAULT_MY_TASK) return true;
  if (filters.status !== DEFAULT_STATUS) return true;
  if (filters.dateRange != null) return true;
  if (filters.planDateRange !== DEFAULT_PLAN_DATE_RANGE) return true;
  if (filters.customPlanMonth != null && filters.customPlanMonth !== '') return true;
  return false;
}
