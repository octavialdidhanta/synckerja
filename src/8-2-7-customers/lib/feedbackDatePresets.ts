import {
  addDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';

export type FeedbackDatePresetId =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom';

export type FeedbackDateRange = {
  from: string;
  to: string;
  preset: FeedbackDatePresetId;
};

function toYmd(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function computeFeedbackPresetRange(
  preset: FeedbackDatePresetId,
  anchor: Date = new Date(),
): { from: string; to: string } {
  const today = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());

  switch (preset) {
    case 'today':
      return { from: toYmd(today), to: toYmd(today) };
    case 'yesterday': {
      const y = subDays(today, 1);
      return { from: toYmd(y), to: toYmd(y) };
    }
    case 'this_week':
      return {
        from: toYmd(startOfWeek(today, { weekStartsOn: 1 })),
        to: toYmd(endOfWeek(today, { weekStartsOn: 1 })),
      };
    case 'last_week': {
      const lastWeek = subWeeks(today, 1);
      return {
        from: toYmd(startOfWeek(lastWeek, { weekStartsOn: 1 })),
        to: toYmd(endOfWeek(lastWeek, { weekStartsOn: 1 })),
      };
    }
    case 'this_month':
      return { from: toYmd(startOfMonth(today)), to: toYmd(endOfMonth(today)) };
    case 'last_month': {
      const lastMonth = subMonths(today, 1);
      return { from: toYmd(startOfMonth(lastMonth)), to: toYmd(endOfMonth(lastMonth)) };
    }
    case 'this_year':
      return { from: toYmd(startOfYear(today)), to: toYmd(endOfYear(today)) };
    case 'last_year': {
      const lastYear = subYears(today, 1);
      return { from: toYmd(startOfYear(lastYear)), to: toYmd(endOfYear(lastYear)) };
    }
    default:
      return { from: toYmd(today), to: toYmd(today) };
  }
}

export function shiftFeedbackRangeByDay(range: FeedbackDateRange, deltaDays: number): FeedbackDateRange {
  const fromDate = new Date(`${range.from}T00:00:00`);
  const toDate = new Date(`${range.to}T00:00:00`);
  const span = Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
  const nextFrom = addDays(fromDate, deltaDays);
  const nextTo = addDays(nextFrom, span);
  return {
    preset: 'custom',
    from: toYmd(nextFrom),
    to: toYmd(nextTo),
  };
}
