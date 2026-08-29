import { format, isToday, isYesterday, startOfDay } from "date-fns";
import type { StockTransferEvent, StockTransferMovement } from "../types";

export type GroupedTransferHistoryDay = {
  dateKey: string;
  label: string;
  movements: StockTransferMovement[];
};

export type TransferTimelineEntry =
  | {
      kind: "event";
      id: string;
      occurredAt: string;
      eventType: StockTransferEvent["eventType"];
      actorName: string;
      comment: string | null;
    }
  | {
      kind: "movement";
      id: string;
      occurredAt: string;
      movement: StockTransferMovement;
    };

export type GroupedTransferTimelineDay = {
  dateKey: string;
  label: string;
  entries: TransferTimelineEntry[];
};

export function buildTransferTimeline(
  events: StockTransferEvent[] = [],
  movements: StockTransferMovement[] = [],
): TransferTimelineEntry[] {
  const items: TransferTimelineEntry[] = [
    ...events.map((event) => ({
      kind: "event" as const,
      id: event.id,
      occurredAt: event.occurredAt,
      eventType: event.eventType,
      actorName: event.actorName,
      comment: event.comment,
    })),
    ...movements.map((movement) => ({
      kind: "movement" as const,
      id: movement.id,
      occurredAt: movement.occurredAt,
      movement,
    })),
  ];

  return items.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

export function groupTransferTimelineByDate(
  entries: TransferTimelineEntry[],
  labels: { today: string; yesterday: string },
): GroupedTransferTimelineDay[] {
  const map = new Map<string, TransferTimelineEntry[]>();
  for (const entry of entries) {
    const day = startOfDay(new Date(entry.occurredAt)).toISOString();
    const bucket = map.get(day) ?? [];
    bucket.push(entry);
    map.set(day, bucket);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dayEntries]) => {
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
        entries: dayEntries.sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        ),
      };
    });
}

export function groupTransferMovementsByDate(
  movements: StockTransferMovement[],
  labels: { today: string; yesterday: string },
): GroupedTransferHistoryDay[] {
  const map = new Map<string, StockTransferMovement[]>();
  for (const movement of movements) {
    const day = startOfDay(new Date(movement.occurredAt)).toISOString();
    const bucket = map.get(day) ?? [];
    bucket.push(movement);
    map.set(day, bucket);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dayMovements]) => {
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
        movements: dayMovements.sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        ),
      };
    });
}

export function transferMovementActionKey(direction: StockTransferMovement["direction"]): string {
  return direction === "out"
    ? "operations.inventory.transfer.history.out"
    : "operations.inventory.transfer.history.in";
}

export function transferMovementDefaultAction(direction: StockTransferMovement["direction"]): string {
  return direction === "out" ? "Transferred stock out" : "Transferred stock in";
}

export function transferEventActionKey(eventType: StockTransferEvent["eventType"]): string {
  return `operations.inventory.transfer.history.event.${eventType}`;
}

export function transferEventDefaultAction(eventType: StockTransferEvent["eventType"]): string {
  const defaults: Record<StockTransferEvent["eventType"], string> = {
    created: "Transfer created",
    approved: "Transfer approved",
    shipped: "Transfer shipped",
    fulfilled: "Transfer fulfilled",
    cancelled: "Transfer cancelled",
  };
  return defaults[eventType];
}
