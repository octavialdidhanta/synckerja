import { calendarDayYmd } from '@/6-1-scheduled-posts/lib/onTimeStatus';

export type ContentTableDatePreset = 'today' | 'yesterday' | 'this_week' | 'month';

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday–Sunday range for a Jakarta calendar day. */
export function jakartaWeekRange(todayYmd: string): { start: string; end: string } {
  const [year, month, day] = todayYmd.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = addCalendarDays(todayYmd, mondayOffset);
  return { start, end: addCalendarDays(start, 6) };
}

/** Day and week presets match the POST DATE column (Asia/Jakarta). Plans without a date stay out. */
export function planMatchesContentDatePreset(
  postDate: string | null | undefined,
  preset: Exclude<ContentTableDatePreset, 'month'>,
  now: Date,
): boolean {
  const day = calendarDayYmd(postDate);
  const today = calendarDayYmd(now);
  if (!day || !today) return false;
  if (preset === 'today') return day === today;
  if (preset === 'yesterday') return day === addCalendarDays(today, -1);
  const week = jakartaWeekRange(today);
  return day >= week.start && day <= week.end;
}
