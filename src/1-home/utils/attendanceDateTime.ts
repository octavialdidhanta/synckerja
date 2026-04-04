/**
 * attendance_records may expose check_in_time / check_out_time as PostgreSQL "time"
 * (e.g. "14:28:54") while check_in_at / check_out_at are timestamptz ISO strings.
 * JS Date and date-fns need a full instant — combine with attendance_date when needed.
 */
export function parseAttendanceInstant(
  attendanceDate: string | null | undefined,
  wallTime: string | null | undefined,
  timestamptzAt?: string | null
): Date | null {
  const at = timestamptzAt != null ? String(timestamptzAt).trim() : '';
  if (at) {
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const date = attendanceDate != null ? String(attendanceDate).trim() : '';
  const time = wallTime != null ? String(wallTime).trim() : '';
  if (!date || !time) return null;
  const timePart = time.split('+')[0].split('Z')[0];
  const d = new Date(`${date}T${timePart}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO string safe for new Date() / date-fns format, or null */
export function attendanceInstantToIso(
  attendanceDate: string | null | undefined,
  wallTime: string | null | undefined,
  timestamptzAt?: string | null
): string | null {
  const d = parseAttendanceInstant(attendanceDate, wallTime, timestamptzAt);
  return d ? d.toISOString() : null;
}

/**
 * PostgreSQL `time` / `time without time zone` from a JS Date: UTC clock (HH:mm:ss[.fractional]).
 * Do not pass a full ISO string here — use `check_in_at` / `check_out_at` for timestamptz.
 */
export function dateToPostgresTimeUtc(d: Date): string {
  if (Number.isNaN(d.getTime())) return "00:00:00";
  const iso = d.toISOString();
  const i = iso.indexOf("T");
  if (i === -1) return "00:00:00";
  let rest = iso.slice(i + 1);
  if (rest.endsWith("Z")) rest = rest.slice(0, -1);
  return rest;
}
