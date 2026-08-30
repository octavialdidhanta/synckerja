import type { KitchenBoardMode } from "./kitchenBoardMode";
import {
  resolveKitchenSalesTypeBucket,
  type KitchenSalesTypeBucket,
} from "./kitchenSalesTypeBucket";
import type { PosKitchenTicket } from "./posKitchenTypes";

export function filterKitchenBoardTickets(args: {
  mode: KitchenBoardMode;
  active: PosKitchenTicket[];
  recall: PosKitchenTicket[];
  completedToday: PosKitchenTicket[];
}): PosKitchenTicket[] {
  const { mode, active, recall, completedToday } = args;
  if (mode.kind === "held") {
    return active.filter((t) => t.is_held);
  }
  if (mode.kind === "recall") {
    return recall;
  }
  if (mode.kind === "completed_today") {
    return completedToday;
  }
  if (mode.salesType === "all") {
    return active;
  }
  const bucket: KitchenSalesTypeBucket = mode.salesType;
  return active.filter(
    (t) => resolveKitchenSalesTypeBucket(t.sales_type_label) === bucket,
  );
}
