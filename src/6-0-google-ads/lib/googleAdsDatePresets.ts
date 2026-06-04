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
  | "all_time"
  | "last_n_days_today"
  | "last_n_days_yesterday";

export type GoogleAdsDateRangeSelection = {
  preset: GoogleAdsDatePresetId;
  range: DateRange;
  /** Used for “N days up to today/yesterday” rows. */
  rollingDays: number;
};

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
  opts?: { accountEarliestYmd?: string | null; rollingDays?: number },
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

/** Jan 1 – Dec 31 (or today when year is current). Used by Report monthly chart year filter. */
export function dateSelectionForCalendarYear(
  year: number,
  now: Date = new Date(),
): GoogleAdsDateRangeSelection {
  const y =
    Number.isFinite(year) && year >= 2000 && year <= 2100
      ? Math.floor(year)
      : now.getFullYear();
  const from = startOfDay(new Date(y, 0, 1));
  const to =
    y === now.getFullYear() ? endOfDay(now) : endOfDay(new Date(y, 11, 31));
  return { preset: "custom", range: { from, to }, rollingDays: 30 };
}

/** True when selection matches {@link dateSelectionForCalendarYear} for the given year. */
export function isCalendarYearSelection(
  selection: GoogleAdsDateRangeSelection,
  year: number,
  now: Date = new Date(),
): boolean {
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
  const calendarYear = dateSelectionForCalendarYear(reportChartYear, now);
  if (dateSelection.preset === "all_time") {
    return calendarYear;
  }
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
