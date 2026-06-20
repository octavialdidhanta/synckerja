/** Threads launched mid-2023; allow earlier YMD for "all time" pagination window. */
export const THREADS_ALL_TIME_START_YMD = "2022-01-01";

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function defaultDateRange(now = new Date()): { start: string; end: string } {
  const end = now;
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

export type ThreadsPostDateRange = {
  startYmd?: string;
  endYmd?: string;
  isAllTime: boolean;
};

/** Parse date_start/date_end/all_time from edge request — no TikTok-style 365-day clamp. */
export function parseThreadsPostDateRange(
  body: Record<string, unknown>,
  now = new Date(),
): ThreadsPostDateRange {
  const allTime = body.all_time === true || body.is_all_time === true;
  if (allTime) {
    return { isAllTime: true };
  }

  const dr = defaultDateRange(now);
  const rawStart = String(body.date_start ?? dr.start).trim();
  const rawEnd = String(body.date_end ?? dr.end).trim();
  const todayYmd = formatDateYmd(now);

  let start = parseYmd(rawStart) ?? parseYmd(dr.start)!;
  let end = parseYmd(rawEnd) ?? now;
  if (end.getTime() > now.getTime()) end = now;
  if (start.getTime() > end.getTime()) start = end;

  let startYmd = formatDateYmd(start);
  const endYmd = formatDateYmd(end);
  if (startYmd > endYmd) startYmd = endYmd;
  if (endYmd > todayYmd) {
    // keep end within today; start already <= end
  }

  return { startYmd, endYmd, isAllTime: false };
}
