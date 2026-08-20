import { format, isToday, isYesterday, startOfDay } from "date-fns";
import type { PurchaseOrderEvent } from "../types";

export type GroupedPoHistoryDay = {
  dateKey: string;
  label: string;
  events: PurchaseOrderEvent[];
};

export function groupPoHistoryByDate(
  events: PurchaseOrderEvent[],
  labels: { today: string; yesterday: string },
): GroupedPoHistoryDay[] {
  const map = new Map<string, PurchaseOrderEvent[]>();
  for (const event of events) {
    const day = startOfDay(new Date(event.occurredAt)).toISOString();
    const bucket = map.get(day) ?? [];
    bucket.push(event);
    map.set(day, bucket);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dayEvents]) => {
      const date = new Date(dateKey);
      let label: string;
      if (isToday(date)) {
        label = `${labels.today}, ${format(date, "MM/dd/yyyy")}`;
      } else if (isYesterday(date)) {
        label = `${labels.yesterday}, ${format(date, "MM/dd/yyyy")}`;
      } else {
        label = format(date, "EEE, MMM d, yyyy");
      }
      return {
        dateKey,
        label,
        events: dayEvents.sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        ),
      };
    });
}

export function poEventActionKey(eventType: PurchaseOrderEvent["eventType"]): string {
  switch (eventType) {
    case "created":
      return "operations.inventory.purchaseOrders.history.created";
    case "fulfilled":
      return "operations.inventory.purchaseOrders.history.fulfilled";
    case "cancelled":
      return "operations.inventory.purchaseOrders.history.cancelled";
    case "edited":
      return "operations.inventory.purchaseOrders.history.edited";
    case "note_updated":
      return "operations.inventory.purchaseOrders.history.noteUpdated";
    default:
      return "operations.inventory.purchaseOrders.history.unknown";
  }
}

export function poEventDefaultAction(eventType: PurchaseOrderEvent["eventType"]): string {
  switch (eventType) {
    case "created":
      return "Created the purchase order";
    case "fulfilled":
      return "Marked the purchase order as fulfilled";
    case "cancelled":
      return "Cancelled the purchase order";
    case "edited":
      return "Edited the purchase order";
    case "note_updated":
      return "Updated the purchase order note";
    default:
      return "Updated the purchase order";
  }
}
