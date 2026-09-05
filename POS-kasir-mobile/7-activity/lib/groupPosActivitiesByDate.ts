import type { PosActivityDateGroup, PosActivityListRow } from "./posActivityTypes";

function toLocalDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rowDateIso(row: PosActivityListRow): string {
  if (row.date && /^\d{4}-\d{2}-\d{2}/.test(row.date)) {
    return row.date.slice(0, 10);
  }
  const d = new Date(row.created_at);
  if (Number.isNaN(d.getTime())) return "unknown";
  return toLocalDateIso(d);
}

/** Same amount basis as the Activity list row UI. */
export function posActivityListRowAmount(row: PosActivityListRow): number {
  return Math.round(row.total_paid_amount || row.total_amount || 0);
}

export function sumPosActivityListAmounts(rows: PosActivityListRow[]): number {
  return rows.reduce((sum, row) => sum + posActivityListRowAmount(row), 0);
}

/**
 * Group activity rows by local calendar day (newest first).
 * Labels: today / yesterday / other date.
 */
export function groupPosActivitiesByDate(
  rows: PosActivityListRow[],
  now: Date = new Date(),
): PosActivityDateGroup[] {
  const todayIso = toLocalDateIso(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = toLocalDateIso(yesterday);

  const map = new Map<string, PosActivityListRow[]>();
  for (const row of rows) {
    const key = rowDateIso(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }

  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
  return keys.map((dateIso) => {
    let labelKind: PosActivityDateGroup["labelKind"] = "date";
    if (dateIso === todayIso) labelKind = "today";
    else if (dateIso === yesterdayIso) labelKind = "yesterday";
    const dayRows = map.get(dateIso) ?? [];
    return {
      key: dateIso,
      labelKind,
      dateIso,
      rows: dayRows,
      totalAmount: sumPosActivityListAmounts(dayRows),
    };
  });
}

/** Format date group header for non-today/yesterday (e.g. Sat, Apr 6, 2024). */
export function formatPosActivityDateHeader(
  dateIso: string,
  locale: string,
): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString(locale.startsWith("en") ? "en-US" : "id-ID", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
