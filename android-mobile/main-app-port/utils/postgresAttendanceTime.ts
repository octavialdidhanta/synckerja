import { format, isValid } from "date-fns";

/**
 * Postgres `time without time zone` is often returned as `HH:mm:ss` (no date).
 * `new Date("09:30:00")` is invalid in browsers — parse explicitly.
 */
export function formatAttendanceTimeShort(value: string | null | undefined): string {
  if (value == null) return "-";
  const s = String(value).trim();
  if (!s) return "-";

  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s) || s.includes("T")) {
    const d = new Date(s);
    return isValid(d) ? format(d, "HH:mm") : "-";
  }

  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (tm) {
    return `${tm[1].padStart(2, "0")}:${tm[2].padStart(2, "0")}`;
  }

  const d = new Date(s);
  return isValid(d) ? format(d, "HH:mm") : "-";
}

/** Same as short but with seconds (for AttendanceStatus). Returns undefined when unparseable. */
export function formatAttendanceTimeWithSeconds(
  value: string | null | undefined,
  locale: string,
): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;

  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s) || s.includes("T")) {
    const d = new Date(s);
    if (!isValid(d)) return undefined;
    return d.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/.exec(s);
  if (tm) {
    const h = tm[1].padStart(2, "0");
    const m = tm[2].padStart(2, "0");
    const sec = (tm[3] ?? "00").padStart(2, "0");
    return `${h}:${m}:${sec}`;
  }

  const d = new Date(s);
  if (!isValid(d)) return undefined;
  return d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Minutes from midnight for a DB time or full timestamp; null if unparseable. */
export function timeStringToMinutesSinceMidnight(value: string | null | undefined): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s) || s.includes("T")) {
    const d = new Date(s);
    if (!isValid(d)) return null;
    return d.getHours() * 60 + d.getMinutes();
  }

  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (tm) {
    const h = parseInt(tm[1], 10);
    const m = parseInt(tm[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  }

  const d = new Date(s);
  if (!isValid(d)) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Build a local Date from `attendance_date` (YYYY-MM-DD) + check_in/check_out time string.
 * Used for duration math when DB stores time-only columns.
 */
export function combineAttendanceDateAndTime(
  attendanceDate: string | null | undefined,
  timeValue: string | null | undefined,
): Date | null {
  if (!timeValue?.trim()) return null;

  const s = String(timeValue).trim();
  const ymd =
    attendanceDate?.trim() ||
    (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    })();

  const parts = ymd.split("-").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, mo, da] = parts;

  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s) || (s.includes("T") && s.length > 12)) {
    const d = new Date(s);
    return isValid(d) ? d : null;
  }

  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/.exec(s);
  if (!tm) {
    const d = new Date(s);
    return isValid(d) ? d : null;
  }

  const h = parseInt(tm[1], 10);
  const min = parseInt(tm[2], 10);
  const sec = tm[3] != null ? parseInt(tm[3], 10) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  return new Date(y, mo - 1, da, h, min, sec, 0);
}

/** Difference in minutes between two same-day-style times; null if either side invalid. */
export function minutesBetweenDbTimes(checkIn: string, checkOut: string, attendanceDate?: string | null): number | null {
  const a = combineAttendanceDateAndTime(attendanceDate, checkIn);
  const b = combineAttendanceDateAndTime(attendanceDate, checkOut);
  if (!a || !b) return null;
  const diff = (b.getTime() - a.getTime()) / (1000 * 60);
  return Number.isFinite(diff) ? diff : null;
}
