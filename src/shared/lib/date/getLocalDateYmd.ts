const pad2 = (value: number) => String(value).padStart(2, '0');

/** Local calendar date `YYYY-MM-DD` (not UTC) — use for visit_date matching on mobile. */
export function getLocalDateYmd(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
