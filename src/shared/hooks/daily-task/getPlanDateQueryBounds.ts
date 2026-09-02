import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import type { TaskFilters } from './useTaskFilters';

export type PlanDateQueryBounds = {
  start: string;
  end: string;
};

/**
 * Inclusive start / exclusive end (YYYY-MM-DD) for `daily_tasks.plan_date`
 * when the summary list is filtered to a plan month.
 */
export function getPlanDateQueryBounds(
  planDateRange: TaskFilters['planDateRange'],
  customPlanMonth?: string,
  now: Date = new Date(),
): PlanDateQueryBounds | null {
  if (!planDateRange) return null;

  const currentMonth = startOfMonth(now);
  let start: Date;

  switch (planDateRange) {
    case 'this_month_plan':
      start = currentMonth;
      break;
    case 'next_month_plan':
      start = addMonths(currentMonth, 1);
      break;
    case 'last_month_plan':
      start = subMonths(currentMonth, 1);
      break;
    case 'custom_month_plan': {
      if (!customPlanMonth) return null;
      const match = /^(\d{4})-(\d{2})/.exec(customPlanMonth);
      if (!match) return null;
      start = new Date(Number(match[1]), Number(match[2]) - 1, 1);
      break;
    }
    default:
      return null;
  }

  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(addMonths(start, 1), 'yyyy-MM-dd'),
  };
}

export function buildDailyTaskCacheKey(
  organizationId: string,
  userId: string,
  planDateRange?: TaskFilters['planDateRange'] | null,
  customPlanMonth?: string | null,
): string {
  return `tasks_${organizationId}_${userId}_${planDateRange || 'all'}_${customPlanMonth || ''}`;
}
