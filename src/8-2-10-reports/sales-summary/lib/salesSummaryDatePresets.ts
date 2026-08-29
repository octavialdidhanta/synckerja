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
} from "date-fns";
import type { SalesSummaryDatePresetId, SalesSummaryDateRange } from "./salesSummaryTypes";

function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function computeSalesSummaryPresetRange(
  preset: SalesSummaryDatePresetId,
  anchor: Date = new Date(),
): { from: string; to: string } {
  const today = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());

  switch (preset) {
    case "today":
      return { from: toYmd(today), to: toYmd(today) };
    case "yesterday": {
      const y = subDays(today, 1);
      return { from: toYmd(y), to: toYmd(y) };
    }
    case "this_week":
      return {
        from: toYmd(startOfWeek(today, { weekStartsOn: 1 })),
        to: toYmd(endOfWeek(today, { weekStartsOn: 1 })),
      };
    case "last_week": {
      const lastWeek = subWeeks(today, 1);
      return {
        from: toYmd(startOfWeek(lastWeek, { weekStartsOn: 1 })),
        to: toYmd(endOfWeek(lastWeek, { weekStartsOn: 1 })),
      };
    }
    case "this_month":
      return { from: toYmd(startOfMonth(today)), to: toYmd(endOfMonth(today)) };
    case "last_month": {
      const lastMonth = subMonths(today, 1);
      return { from: toYmd(startOfMonth(lastMonth)), to: toYmd(endOfMonth(lastMonth)) };
    }
    case "this_year":
      return { from: toYmd(startOfYear(today)), to: toYmd(endOfYear(today)) };
    case "last_year": {
      const lastYear = subYears(today, 1);
      return { from: toYmd(startOfYear(lastYear)), to: toYmd(endOfYear(lastYear)) };
    }
    default:
      return { from: toYmd(today), to: toYmd(today) };
  }
}

export function defaultSalesSummaryDateRange(anchor: Date = new Date()): SalesSummaryDateRange {
  const range = computeSalesSummaryPresetRange("this_month", anchor);
  return { preset: "this_month", ...range };
}

/** Shift the inclusive day span by ±1 period length. */
export function shiftSalesSummaryRangeByDay(
  range: SalesSummaryDateRange,
  deltaPeriods: number,
): SalesSummaryDateRange {
  const fromDate = new Date(`${range.from}T00:00:00`);
  const toDate = new Date(`${range.to}T00:00:00`);
  const span = Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
  const nextFrom = addDays(fromDate, deltaPeriods * (span + 1));
  const nextTo = addDays(nextFrom, span);
  return {
    preset: "custom",
    from: toYmd(nextFrom),
    to: toYmd(nextTo),
  };
}

/**
 * Build exclusive [from, to) timestamptz bounds in Asia/Jakarta (WIB, UTC+7).
 * RPC uses `created_at < p_to`.
 */
export function salesSummaryRangeToTimestamps(args: {
  fromYmd: string;
  toYmd: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
}): { fromIso: string; toIso: string } {
  const start = normalizeHm(args.allDay ? "00:00" : args.startTime);
  const end = normalizeHm(args.allDay ? "23:59" : args.endTime);

  const fromIso = `${args.fromYmd}T${start}:00+07:00`;

  if (args.allDay) {
    const nextDay = addDays(new Date(`${args.toYmd}T00:00:00`), 1);
    return { fromIso, toIso: `${toYmd(nextDay)}T00:00:00+07:00` };
  }

  const [eh, em] = end.split(":").map(Number);
  let endMinute = eh * 60 + em + 1;
  let endYmd = args.toYmd;
  if (endMinute >= 24 * 60) {
    endMinute = 0;
    endYmd = toYmd(addDays(new Date(`${args.toYmd}T00:00:00`), 1));
  }
  const toH = String(Math.floor(endMinute / 60)).padStart(2, "0");
  const toM = String(endMinute % 60).padStart(2, "0");
  return { fromIso, toIso: `${endYmd}T${toH}:${toM}:00+07:00` };
}

function normalizeHm(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((raw || "").trim());
  if (!m) return "00:00";
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
