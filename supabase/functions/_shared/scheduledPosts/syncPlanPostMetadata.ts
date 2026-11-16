const JAKARTA_TIME_ZONE = "Asia/Jakarta";

/** Calendar day as YYYY-MM-DD. Date-only strings stay as-is; timestamps use Asia/Jakarta. */
export function calendarDayYmd(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function daysBetweenYmd(later: string, earlier: string): number {
  const [ly, lm, ld] = later.split("-").map(Number);
  const [ey, em, ed] = earlier.split("-").map(Number);
  const laterUtc = Date.UTC(ly, lm - 1, ld);
  const earlierUtc = Date.UTC(ey, em - 1, ed);
  return Math.round((laterUtc - earlierUtc) / 86_400_000);
}

/**
 * Compare actual vs planned post calendar days in Asia/Jakarta.
 * Same day or earlier actual → Ontime; otherwise Late N Day(s).
 */
export function calculateOnTimeStatus(
  actualPostDateIso: string | null,
  postDateIso: string | null,
): string {
  const actual = calendarDayYmd(actualPostDateIso);
  const planned = calendarDayYmd(postDateIso);
  if (!actual || !planned) return "";
  const diffDays = daysBetweenYmd(actual, planned);
  if (diffDays <= 0) return "Ontime";
  return `Late ${diffDays} Day${diffDays > 1 ? "s" : ""}`;
}

export function todayDateIsoJakarta(now: Date = new Date()): string {
  return calendarDayYmd(now) ?? new Date().toISOString().slice(0, 10);
}

/** @deprecated Use todayDateIsoJakarta — name kept for existing callers. */
export function todayDateIsoUtc(): string {
  return todayDateIsoJakarta();
}

export function buildPlanPostMetadataUpdates(
  postDateIso: string | null,
  publishedAtIso: string = new Date().toISOString(),
): { actual_post_date: string; on_time_status: string } {
  const actualDate = calendarDayYmd(publishedAtIso) ?? todayDateIsoJakarta();
  return {
    actual_post_date: actualDate,
    on_time_status: calculateOnTimeStatus(actualDate, postDateIso),
  };
}
