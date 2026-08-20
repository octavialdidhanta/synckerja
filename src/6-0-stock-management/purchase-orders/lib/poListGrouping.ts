import { format, startOfDay } from "date-fns";
import type { PurchaseOrderListRow } from "../types";

export type PurchaseOrderDateGroup = {
  dateKey: string;
  label: string;
  rows: PurchaseOrderListRow[];
};

export function groupPurchaseOrdersByDate(rows: PurchaseOrderListRow[]): PurchaseOrderDateGroup[] {
  const map = new Map<string, PurchaseOrderListRow[]>();
  for (const row of rows) {
    const key = startOfDay(new Date(row.occurredAt)).toISOString();
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, groupRows]) => ({
      dateKey,
      label: format(new Date(dateKey), "EEE, MMM d, yyyy"),
      rows: groupRows.sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
    }));
}
