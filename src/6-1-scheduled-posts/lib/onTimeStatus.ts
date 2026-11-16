const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

/** Calendar day as YYYY-MM-DD. Date-only strings stay as-is; timestamps use Asia/Jakarta. */
export function calendarDayYmd(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function daysBetweenYmd(later: string, earlier: string): number {
  const [ly, lm, ld] = later.split('-').map(Number);
  const [ey, em, ed] = earlier.split('-').map(Number);
  const laterUtc = Date.UTC(ly, lm - 1, ld);
  const earlierUtc = Date.UTC(ey, em - 1, ed);
  return Math.round((laterUtc - earlierUtc) / 86_400_000);
}

/**
 * Compare actual vs planned post calendar days in Asia/Jakarta.
 * Same day or earlier actual → Ontime; otherwise Late N Day(s).
 */
export function calculateOnTimeStatus(
  actualPostDate: string | Date | null | undefined,
  plannedPostDate: string | Date | null | undefined,
): string {
  const actual = calendarDayYmd(actualPostDate);
  const planned = calendarDayYmd(plannedPostDate);
  if (!actual || !planned) return '';
  const diffDays = daysBetweenYmd(actual, planned);
  if (diffDays <= 0) return 'Ontime';
  return `Late ${diffDays} Day${diffDays > 1 ? 's' : ''}`;
}
