import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import type { DateRange } from "react-day-picker";

/** Preset ids aligned with Google Ads date picker sidebar. */
export type GoogleAdsDatePresetId =
  | "custom"
  | "today"
  | "yesterday"
  | "this_week_mon_today"
  | "last_7_days"
  | "last_week_mon_sun"
  | "last_14_days"
  | "this_month"
  | "last_30_days"
  | "last_month"
  | "calendar_year"
  | "calendar_quarter"
  | "all_time"
  | "last_n_days_today"
  | "last_n_days_yesterday";

export type GoogleAdsDateRangeSelection = {
  preset: GoogleAdsDatePresetId;
  range: DateRange;
  /** Used for “N days up to today/yesterday” rows. */
  rollingDays: number;
  /** When preset is calendar_year or calendar_quarter. */
  calendarYear?: number;
  /** When preset is calendar_quarter (Q1–Q4). */
  calendarQuarter?: CalendarQuarter;
};

export type CalendarQuarter = 1 | 2 | 3 | 4;

const WEEK_OPTS = { weekStartsOn: 1 as const };

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computePresetRange(
  preset: GoogleAdsDatePresetId,
  now: Date,
  opts?: {
    accountEarliestYmd?: string | null;
    rollingDays?: number;
    calendarYear?: number;
    calendarQuarter?: CalendarQuarter;
  },
): DateRange {
  const today = startOfDay(now);
  const rolling = Math.max(1, Math.min(999, opts?.rollingDays ?? 30));

  switch (preset) {
    case "today":
      return { from: today, to: endOfDay(today) };
    case "yesterday": {
      const y = subDays(today, 1);
      return { from: y, to: endOfDay(y) };
    }
    case "this_week_mon_today":
      return {
        from: startOfWeek(today, WEEK_OPTS),
        to: endOfDay(today),
      };
    case "last_7_days":
      return { from: startOfDay(subDays(today, 6)), to: endOfDay(today) };
    case "last_week_mon_sun": {
      const prev = subWeeks(today, 1);
      return {
        from: startOfWeek(prev, WEEK_OPTS),
        to: endOfWeek(prev, WEEK_OPTS),
      };
    }
    case "last_14_days":
      return { from: startOfDay(subDays(today, 13)), to: endOfDay(today) };
    case "this_month":
      return { from: startOfMonth(today), to: endOfDay(today) };
    case "last_30_days":
      return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) };
    case "last_month": {
      const prev = subMonths(today, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "last_n_days_today":
      return { from: startOfDay(subDays(today, rolling - 1)), to: endOfDay(today) };
    case "last_n_days_yesterday": {
      const y = subDays(today, 1);
      return {
        from: startOfDay(subDays(y, rolling - 1)),
        to: endOfDay(y),
      };
    }
    case "calendar_year": {
      const y =
        typeof opts?.calendarYear === "number" && opts.calendarYear >= 2000
          ? Math.floor(opts.calendarYear)
          : today.getFullYear();
      const from = startOfDay(new Date(y, 0, 1));
      const to =
        y === today.getFullYear() ? endOfDay(today) : endOfDay(new Date(y, 11, 31));
      return { from, to };
    }
    case "calendar_quarter": {
      const sel = dateSelectionForCalendarQuarter(
        opts?.calendarYear ?? today.getFullYear(),
        opts?.calendarQuarter ?? currentCalendarQuarter(today),
        now,
      );
      return sel.range;
    }
    case "all_time": {
      const end = endOfDay(today);
      const parsed = opts?.accountEarliestYmd
        ? parseYmdLocal(opts.accountEarliestYmd)
        : null;
      const from = parsed ? startOfDay(parsed) : startOfDay(subDays(today, 1094));
      return { from, to: end };
    }
    case "custom":
    default:
      return { from: today, to: endOfDay(today) };
  }
}

export function defaultGoogleAdsDateSelection(
  accountEarliestYmd?: string | null,
): GoogleAdsDateRangeSelection {
  const range = computePresetRange("last_30_days", new Date(), { accountEarliestYmd });
  return { preset: "last_30_days", range, rollingDays: 30 };
}

function normalizeCalendarYear(year: number, fallback: number): number {
  return Number.isFinite(year) && year >= 2000 && year <= 2100
    ? Math.floor(year)
    : fallback;
}

function normalizeCalendarQuarter(quarter: number): CalendarQuarter {
  const q = Math.floor(quarter);
  if (q >= 1 && q <= 4) return q as CalendarQuarter;
  return 1;
}

export function currentCalendarQuarter(now: Date = new Date()): CalendarQuarter {
  return (Math.floor(now.getMonth() / 3) + 1) as CalendarQuarter;
}

/** Calendar quarter bounds (Q1 = Jan–Mar, …, Q4 = Oct–Dec). End is today when quarter is in progress. */
export function dateSelectionForCalendarQuarter(
  year: number,
  quarter: CalendarQuarter,
  now: Date = new Date(),
): GoogleAdsDateRangeSelection {
  const y = normalizeCalendarYear(year, now.getFullYear());
  const q = normalizeCalendarQuarter(quarter);
  const startMonth = (q - 1) * 3;
  const from = startOfDay(new Date(y, startMonth, 1));
  const quarterEnd = endOfDay(new Date(y, startMonth + 3, 0));
  const today = startOfDay(now);
  const isCurrentYear = y === today.getFullYear();
  const activeQuarter = currentCalendarQuarter(now);
  const to =
    isCurrentYear && q === activeQuarter
      ? endOfDay(now)
      : isCurrentYear && q > activeQuarter
        ? endOfDay(from)
        : quarterEnd;
  return {
    preset: "calendar_quarter",
    calendarYear: y,
    calendarQuarter: q,
    range: { from, to },
    rollingDays: 30,
  };
}

export function isCalendarQuarterSelection(
  selection: GoogleAdsDateRangeSelection,
  year: number,
  quarter: CalendarQuarter,
  now: Date = new Date(),
): boolean {
  if (
    selection.preset === "calendar_quarter" &&
    selection.calendarYear === year &&
    selection.calendarQuarter === quarter
  ) {
    return true;
  }
  const expected = dateSelectionForCalendarQuarter(year, quarter, now);
  const from = selection.range.from;
  const to = selection.range.to;
  const expFrom = expected.range.from;
  const expTo = expected.range.to;
  if (!from || !to || !expFrom || !expTo) return false;
  return toYmdLocal(from) === toYmdLocal(expFrom) && toYmdLocal(to) === toYmdLocal(expTo);
}

/** True when the quarter has any overlap with [minDate, maxDate]. */
export function calendarQuarterOverlapsRange(
  year: number,
  quarter: CalendarQuarter,
  minDate: Date,
  maxDate: Date = new Date(),
  now: Date = new Date(),
): boolean {
  const sel = dateSelectionForCalendarQuarter(year, quarter, now);
  const from = sel.range.from;
  const to = sel.range.to;
  if (!from || !to) return false;
  const rangeStart = startOfDay(from);
  const rangeEnd = endOfDay(to);
  const min = startOfDay(minDate);
  const max = endOfDay(maxDate);
  return rangeStart.getTime() <= max.getTime() && rangeEnd.getTime() >= min.getTime();
}

/** Jan 1 – Dec 31 (or today when year is current). Used by Report monthly chart year filter. */
export function dateSelectionForCalendarYear(
  year: number,
  now: Date = new Date(),
): GoogleAdsDateRangeSelection {
  const y = normalizeCalendarYear(year, now.getFullYear());
  const from = startOfDay(new Date(y, 0, 1));
  const to =
    y === now.getFullYear() ? endOfDay(now) : endOfDay(new Date(y, 11, 31));
  return { preset: "calendar_year", calendarYear: y, range: { from, to }, rollingDays: 30 };
}

export function calendarYearFromSelection(
  selection: GoogleAdsDateRangeSelection,
): number | null {
  if (selection.preset === "calendar_year" && selection.calendarYear != null) {
    return selection.calendarYear;
  }
  const from = selection.range.from;
  const to = selection.range.to;
  if (from && to && from.getFullYear() === to.getFullYear()) {
    return from.getFullYear();
  }
  return null;
}

/** True when selection matches {@link dateSelectionForCalendarYear} for the given year. */
export function isCalendarYearSelection(
  selection: GoogleAdsDateRangeSelection,
  year: number,
  now: Date = new Date(),
): boolean {
  if (selection.preset === "calendar_year" && selection.calendarYear === year) {
    return true;
  }
  const expected = dateSelectionForCalendarYear(year, now);
  const from = selection.range.from;
  const to = selection.range.to;
  const expFrom = expected.range.from;
  const expTo = expected.range.to;
  if (!from || !to || !expFrom || !expTo) return false;
  return toYmdLocal(from) === toYmdLocal(expFrom) && toYmdLocal(to) === toYmdLocal(expTo);
}

/**
 * Report chart range: intersection of the date picker with the selected calendar year.
 * Returns null when there is no overlap (e.g. Last month 2026 while chart year is 2022).
 */
export function intersectDateSelectionWithChartYear(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  now: Date = new Date(),
): GoogleAdsDateRangeSelection | null {
  if (dateSelection.preset === "calendar_year" && dateSelection.calendarYear != null) {
    return dateSelectionForCalendarYear(dateSelection.calendarYear, now);
  }
  if (
    dateSelection.preset === "calendar_quarter" &&
    dateSelection.calendarYear != null &&
    dateSelection.calendarQuarter != null
  ) {
    if (dateSelection.calendarYear !== reportChartYear) return null;
    return dateSelectionForCalendarQuarter(
      dateSelection.calendarYear,
      dateSelection.calendarQuarter,
      now,
    );
  }
  if (dateSelection.preset === "all_time") {
    const from = dateSelection.range.from;
    const to = dateSelection.range.to;
    if (!from || !to) return null;
    return {
      preset: "custom",
      range: { from: startOfDay(from), to: endOfDay(to) },
      rollingDays: dateSelection.rollingDays,
    };
  }

  const calendarYear = dateSelectionForCalendarYear(reportChartYear, now);
  const from = dateSelection.range.from;
  const to = dateSelection.range.to;
  if (!from || !to) {
    return calendarYear;
  }
  const yearStart = startOfDay(new Date(reportChartYear, 0, 1));
  const yearEnd = calendarYear.range.to!;
  const selFrom = startOfDay(from);
  const selTo = endOfDay(to);
  const intersectFrom = selFrom.getTime() > yearStart.getTime() ? selFrom : yearStart;
  const intersectTo = selTo.getTime() < yearEnd.getTime() ? selTo : yearEnd;
  if (intersectFrom.getTime() > intersectTo.getTime()) return null;
  return {
    preset: "custom",
    range: { from: intersectFrom, to: intersectTo },
    rollingDays: dateSelection.rollingDays,
  };
}

export function formatPickerRangeDates(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  if (from.getTime() === to.getTime()) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

function formatPickerLabelWithRange(title: string, from?: Date, to?: Date): string {
  if (from && to) return `${title} · ${formatPickerRangeDates(from, to)}`;
  return title;
}

export function formatGoogleAdsPickerButtonLabel(
  selection: GoogleAdsDateRangeSelection,
): string {
  const { from, to } = selection.range;
  const labels: Partial<Record<GoogleAdsDatePresetId, string>> = {
    today: "Today",
    yesterday: "Yesterday",
    this_week_mon_today: "This week (Mon – Today)",
    last_7_days: "Last 7 days",
    last_week_mon_sun: "Last week (Mon – Sun)",
    last_14_days: "Last 14 days",
    this_month: "This month",
    last_30_days: "Last 30 days",
    last_month: "Last month",
    last_n_days_today: `${selection.rollingDays} days up to today`,
    last_n_days_yesterday: `${selection.rollingDays} days up to yesterday`,
    custom: "Custom",
  };

  if (selection.preset === "all_time") {
    return formatPickerLabelWithRange("All time", from, to);
  }

  if (selection.preset === "calendar_year" && selection.calendarYear != null) {
    return formatPickerLabelWithRange(String(selection.calendarYear), from, to);
  }

  if (
    selection.preset === "calendar_quarter" &&
    selection.calendarYear != null &&
    selection.calendarQuarter != null
  ) {
    return formatPickerLabelWithRange(
      `${selection.calendarYear} Q${selection.calendarQuarter}`,
      from,
      to,
    );
  }

  if (selection.preset !== "custom" && labels[selection.preset]) {
    return formatPickerLabelWithRange(labels[selection.preset]!, from, to);
  }

  if (!from || !to) return "Custom";
  return formatPickerRangeDates(from, to);
}

/** API body for google-ads-metrics edge function. */
export function toGoogleAdsMetricsDateRangePayload(
  selection: GoogleAdsDateRangeSelection,
): { preset?: string; start: string; end: string } {
  const from = selection.range.from;
  const to = selection.range.to;
  if (!from || !to) {
    const fallback = computePresetRange("today", new Date());
    return {
      preset: "TODAY",
      start: toYmdLocal(fallback.from!),
      end: toYmdLocal(fallback.to!),
    };
  }
  const start = toYmdLocal(from);
  const end = toYmdLocal(to);

  if (selection.preset === "all_time") {
    return { preset: "ALL_TIME", start, end };
  }
  if (selection.preset === "today") {
    return { preset: "TODAY", start, end };
  }
  if (selection.preset === "last_7_days") {
    return { preset: "LAST_7_DAYS", start, end };
  }
  if (selection.preset === "last_30_days") {
    return { preset: "LAST_30_DAYS", start, end };
  }
  return { start, end };
}
