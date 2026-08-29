import { format, parseISO } from "date-fns";
import type { DateGroupedRow } from "./transactionsTypes";

export function localDateKey(iso: string): string {
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return iso.slice(0, 10);
  }
}

export function localDateLabel(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE, d MMM yyyy");
  } catch {
    return iso.slice(0, 10);
  }
}

export function groupRowsByLocalDate<T extends { createdAt?: string; closedAt?: string }>(
  rows: T[],
  amountOf: (row: T) => number,
  dateOf: (row: T) => string = (row) => row.createdAt ?? row.closedAt ?? "",
): DateGroupedRow<T>[] {
  const map = new Map<string, DateGroupedRow<T>>();

  for (const row of rows) {
    const iso = dateOf(row);
    const key = localDateKey(iso);
    const existing = map.get(key);
    const amount = amountOf(row);
    if (existing) {
      existing.rows.push(row);
      existing.dayTotal += amount;
    } else {
      map.set(key, {
        dateKey: key,
        dateLabel: localDateLabel(iso),
        dayTotal: amount,
        rows: [row],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
