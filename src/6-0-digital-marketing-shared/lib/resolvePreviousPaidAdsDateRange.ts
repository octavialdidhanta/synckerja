import {
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  parseYmdLocal,
  toYmdLocal,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";

const WEEK_OPTS = { weekStartsOn: 1 as const };

export type PaidAdsKpiCompareLabelKey =
  | "vsYesterday"
  | "vsPreviousDay"
  | "vsLastWeek"
  | "vsPreviousWeek"
  | "vsLastMonth"
  | "vsPreviousMonth"
  | "vsPreviousPeriod"
  | "vsPreviousYear"
  | "vsPreviousQuarter";

export type PreviousPaidAdsDateRange = {
  fromDate: string;
  toDate: string;
  labelKey: PaidAdsKpiCompareLabelKey;
};

function shiftEqualLength(
  from: Date,
  to: Date,
  labelKey: PaidAdsKpiCompareLabelKey,
): PreviousPaidAdsDateRange {
  const days = differenceInCalendarDays(to, from) + 1;
  const previousTo = subDays(startOfDay(from), 1);
  const previousFrom = subDays(previousTo, Math.max(0, days - 1));
  return {
    fromDate: toYmdLocal(previousFrom),
    toDate: toYmdLocal(previousTo),
    labelKey,
  };
}

function previousFullWeek(weekStart: Date, labelKey: PaidAdsKpiCompareLabelKey): PreviousPaidAdsDateRange {
  const prev = subWeeks(startOfDay(weekStart), 1);
  return {
    fromDate: toYmdLocal(startOfWeek(prev, WEEK_OPTS)),
    toDate: toYmdLocal(endOfWeek(prev, WEEK_OPTS)),
    labelKey,
  };
}

function previousFullMonth(monthStart: Date, labelKey: PaidAdsKpiCompareLabelKey): PreviousPaidAdsDateRange {
  const prev = subMonths(startOfMonth(monthStart), 1);
  return {
    fromDate: toYmdLocal(startOfMonth(prev)),
    toDate: toYmdLocal(endOfMonth(prev)),
    labelKey,
  };
}

function previousFullQuarter(quarterStart: Date): PreviousPaidAdsDateRange {
  const month = quarterStart.getMonth();
  const year = quarterStart.getFullYear();
  let prevQuarterIndex = Math.floor(month / 3) - 1;
  let prevYear = year;
  if (prevQuarterIndex < 0) {
    prevQuarterIndex = 3;
    prevYear -= 1;
  }
  const startMonth = prevQuarterIndex * 3;
  const from = new Date(prevYear, startMonth, 1);
  const to = new Date(prevYear, startMonth + 3, 0);
  return {
    fromDate: toYmdLocal(startOfDay(from)),
    toDate: toYmdLocal(startOfDay(to)),
    labelKey: "vsPreviousQuarter",
  };
}

/** Previous comparison window for paid-ads / traffic KPI cards. Null = hide compare (e.g. All time). */
export function resolvePreviousPaidAdsDateRange(
  dateSelection: GoogleAdsDateRangeSelection,
  fromDate: string | null,
  toDate: string | null,
): PreviousPaidAdsDateRange | null {
  if (dateSelection.preset === "all_time") return null;

  const from = fromDate ? parseYmdLocal(fromDate) : null;
  const to = toDate ? parseYmdLocal(toDate) : null;
  if (!from || !to) return null;

  switch (dateSelection.preset) {
    case "today":
      return shiftEqualLength(from, to, "vsYesterday");
    case "yesterday":
      return shiftEqualLength(from, to, "vsPreviousDay");
    case "this_week_mon_today":
      return previousFullWeek(from, "vsLastWeek");
    case "last_week_mon_sun":
      return previousFullWeek(from, "vsPreviousWeek");
    case "this_month":
      return previousFullMonth(from, "vsLastMonth");
    case "last_month":
      return previousFullMonth(from, "vsPreviousMonth");
    case "calendar_year": {
      const year = (dateSelection.calendarYear ?? from.getFullYear()) - 1;
      return {
        fromDate: `${year}-01-01`,
        toDate: `${year}-12-31`,
        labelKey: "vsPreviousYear",
      };
    }
    case "calendar_quarter":
      return previousFullQuarter(from);
    case "last_7_days":
    case "last_14_days":
    case "last_30_days":
    case "last_n_days_today":
    case "last_n_days_yesterday":
    case "custom":
      return shiftEqualLength(from, to, "vsPreviousPeriod");
    default:
      return shiftEqualLength(from, to, "vsPreviousPeriod");
  }
}
