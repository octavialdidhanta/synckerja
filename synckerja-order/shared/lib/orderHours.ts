export const ORDER_HOURS_TIMEZONE = "Asia/Jakarta";
export const DEFAULT_OPEN_HHMM = "11:00";
export const DEFAULT_CLOSE_HHMM = "22:00";

export type WeeklyHourRule = {
  dow: number;
  closed: boolean;
  open: string;
  close: string;
};

export type OrderHoursState = {
  isOpen: boolean;
  forceClosed: boolean;
  openHhmm: string | null;
  closeHhmm: string | null;
  nextOpenHhmm: string | null;
  nextOpenIsToday: boolean;
  nextOpenDow: number | null;
  closesAt: Date | null;
  nextOpenAt: Date | null;
};

const DOW_FROM_SHORT: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function defaultWeeklyHours(): WeeklyHourRule[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dow: i + 1,
    closed: false,
    open: DEFAULT_OPEN_HHMM,
    close: DEFAULT_CLOSE_HHMM,
  }));
}

export function normalizeWeeklyHours(raw: unknown): WeeklyHourRule[] {
  const defaults = defaultWeeklyHours();
  if (!Array.isArray(raw)) return defaults;
  return defaults.map((fallback) => {
    const found = raw.find((row) => Number((row as WeeklyHourRule)?.dow) === fallback.dow) as
      | WeeklyHourRule
      | undefined;
    if (!found) return fallback;
    return {
      dow: fallback.dow,
      closed: Boolean(found.closed),
      open: normalizeHhmm(found.open) ?? fallback.open,
      close: normalizeHhmm(found.close) ?? fallback.close,
    };
  });
}

export function minutesFromHhmm(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return 0;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return hours * 60 + minutes;
}

export function hhmmFromMinutes(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeHhmm(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
  return hhmmFromMinutes(minutesFromHhmm(trimmed));
}

export function wallClockInZone(at: Date, timeZone = ORDER_HOURS_TIMEZONE): { dow: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { dow: DOW_FROM_SHORT[weekday] ?? 1, minutes: hour * 60 + minute };
}

function ruleFor(hours: WeeklyHourRule[], dow: number): WeeklyHourRule {
  return hours.find((row) => row.dow === dow) ?? {
    dow,
    closed: false,
    open: DEFAULT_OPEN_HHMM,
    close: DEFAULT_CLOSE_HHMM,
  };
}

function prevDow(dow: number): number {
  return dow === 1 ? 7 : dow - 1;
}

function nextDow(dow: number): number {
  return dow === 7 ? 1 : dow + 1;
}

function isOvernight(rule: WeeklyHourRule): boolean {
  return !rule.closed && minutesFromHhmm(rule.close) < minutesFromHhmm(rule.open);
}

function inDaytimeWindow(rule: WeeklyHourRule, minutes: number): boolean {
  if (rule.closed) return false;
  const open = minutesFromHhmm(rule.open);
  const close = minutesFromHhmm(rule.close);
  if (close === open) return true;
  if (close > open) return minutes >= open && minutes < close;
  return minutes >= open;
}

function inOvernightMorning(yesterday: WeeklyHourRule, minutes: number): boolean {
  if (!isOvernight(yesterday)) return false;
  return minutes < minutesFromHhmm(yesterday.close);
}

export function evaluateOrderHours(args: {
  weeklyHours: unknown;
  forceClosed?: boolean;
  at?: Date;
  timeZone?: string;
}): OrderHoursState {
  const weeklyHours = normalizeWeeklyHours(args.weeklyHours);
  const forceClosed = Boolean(args.forceClosed);
  const at = args.at ?? new Date();
  const timeZone = args.timeZone ?? ORDER_HOURS_TIMEZONE;
  const { dow, minutes } = wallClockInZone(at, timeZone);
  const today = ruleFor(weeklyHours, dow);
  const yesterday = ruleFor(weeklyHours, prevDow(dow));

  if (forceClosed) {
    const next = findNextOpen(weeklyHours, dow, minutes, true);
    return {
      isOpen: false,
      forceClosed: true,
      openHhmm: null,
      closeHhmm: null,
      nextOpenHhmm: next?.hhmm ?? null,
      nextOpenIsToday: next?.isToday ?? false,
      nextOpenDow: next?.dow ?? null,
      closesAt: null,
      nextOpenAt: next ? offsetDate(at, next.dayOffset, next.hhmm, timeZone) : null,
    };
  }

  const openFromToday = inDaytimeWindow(today, minutes);
  const openFromYesterday = inOvernightMorning(yesterday, minutes);
  const isOpen = openFromToday || openFromYesterday;

  if (isOpen) {
    const closeHhmm = openFromYesterday ? yesterday.close : today.close;
    const closeIsTomorrow = openFromToday && isOvernight(today);
    return {
      isOpen: true,
      forceClosed: false,
      openHhmm: openFromYesterday ? yesterday.open : today.open,
      closeHhmm,
      nextOpenHhmm: null,
      nextOpenIsToday: false,
      nextOpenDow: null,
      closesAt: offsetDate(at, closeIsTomorrow ? 1 : 0, closeHhmm, timeZone),
      nextOpenAt: null,
    };
  }

  const next = findNextOpen(weeklyHours, dow, minutes, false);
  return {
    isOpen: false,
    forceClosed: false,
    openHhmm: null,
    closeHhmm: null,
    nextOpenHhmm: next?.hhmm ?? null,
    nextOpenIsToday: next?.isToday ?? false,
    nextOpenDow: next?.dow ?? null,
    closesAt: null,
    nextOpenAt: next ? offsetDate(at, next.dayOffset, next.hhmm, timeZone) : null,
  };
}

function findNextOpen(
  hours: WeeklyHourRule[],
  dow: number,
  minutes: number,
  skipTodayRemaining: boolean,
): { dow: number; hhmm: string; isToday: boolean; dayOffset: number } | null {
  const today = ruleFor(hours, dow);
  if (!skipTodayRemaining && !today.closed && minutes < minutesFromHhmm(today.open)) {
    return { dow, hhmm: today.open, isToday: true, dayOffset: 0 };
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    let cursor = dow;
    for (let i = 0; i < offset; i += 1) cursor = nextDow(cursor);
    const rule = ruleFor(hours, cursor);
    if (!rule.closed) {
      return { dow: cursor, hhmm: rule.open, isToday: false, dayOffset: offset };
    }
  }
  return null;
}

function offsetDate(from: Date, dayOffset: number, hhmm: string, timeZone: string): Date {
  const utc = from.getTime() + dayOffset * 24 * 60 * 60 * 1000;
  const probe = new Date(utc);
  const { minutes: nowMins } = wallClockInZone(probe, timeZone);
  const target = minutesFromHhmm(hhmm);
  return new Date(probe.getTime() + (target - nowMins) * 60 * 1000);
}

export type OrderHoursBadgeKind = "open" | "closedToday" | "closedLater";

export function orderHoursBadge(args: {
  isOpen: boolean;
  closeHhmm: string | null;
  nextOpenHhmm: string | null;
  nextOpenIsToday: boolean;
}): { kind: OrderHoursBadgeKind; time: string | null } {
  if (args.isOpen) return { kind: "open", time: args.closeHhmm };
  if (args.nextOpenIsToday && args.nextOpenHhmm) {
    return { kind: "closedToday", time: args.nextOpenHhmm };
  }
  return { kind: "closedLater", time: args.nextOpenHhmm };
}
