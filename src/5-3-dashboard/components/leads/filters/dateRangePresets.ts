import type { DateRange } from "react-day-picker";
import { endOfDay, startOfDay, subDays } from "date-fns";

/** Aligned with `DateRangeFilter` "Last 30 days" (today + 29 hari sebelumnya). */
export function getLast30DaysDateRange(now: Date = new Date()): DateRange {
  return {
    from: startOfDay(subDays(now, 29)),
    to: endOfDay(now),
  };
}
