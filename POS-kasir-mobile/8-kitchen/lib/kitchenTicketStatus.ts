import type { PosKitchenTicketStatus } from "./posKitchenTypes";

export const POS_KITCHEN_I18N = {
  title: "posKitchen.title",
  tabNew: "posKitchen.tabNew",
  tabInProgress: "posKitchen.tabInProgress",
  tabReady: "posKitchen.tabReady",
  empty: "posKitchen.empty",
  emptyTab: "posKitchen.emptyTab",
  emptyRecall: "posKitchen.emptyRecall",
  emptyCompleted: "posKitchen.emptyCompleted",
  advanceError: "posKitchen.advanceError",
  itemQty: "posKitchen.itemQty",
  menu: "posKitchen.menu",
  guestUnknown: "posKitchen.guestUnknown",
  waitMinutes: "posKitchen.waitMinutes",
  waitHoursMinutes: "posKitchen.waitHoursMinutes",
  waitSecondsLabel: "posKitchen.waitSecondsLabel",
  waitMinutesLabel: "posKitchen.waitMinutesLabel",
  salesTypeFallback: "posKitchen.salesTypeFallback",
  hold: "posKitchen.hold",
  resume: "posKitchen.resume",
  start: "posKitchen.start",
  inProgress: "posKitchen.inProgress",
  done: "posKitchen.done",
  readyPercent: "posKitchen.readyPercent",
  open: "posKitchen.open",
  completed: "posKitchen.completed",
  dineIn: "posKitchen.dineIn",
  takeaway: "posKitchen.takeaway",
  delivery: "posKitchen.delivery",
  pickup: "posKitchen.pickup",
  recall: "posKitchen.recall",
  onHold: "posKitchen.onHold",
  settings: "posKitchen.settingsNav",
  recallAction: "posKitchen.recallAction",
  revertAction: "posKitchen.revertAction",
  recalledBadge: "posKitchen.recalledBadge",
  revertedBadge: "posKitchen.revertedBadge",
  restoreWindowExpired: "posKitchen.restoreWindowExpired",
} as const;

/** Active board tabs only (done/void are off-board). */
export const POS_KITCHEN_BOARD_TABS: readonly PosKitchenTicketStatus[] = [
  "new",
  "in_progress",
  "ready",
] as const;

export function nextKitchenTicketStatus(
  status: PosKitchenTicketStatus,
): PosKitchenTicketStatus | null {
  if (status === "new") return "in_progress";
  if (status === "in_progress") return "ready";
  if (status === "ready") return "done";
  return null;
}

/**
 * Start and Done are clickable; In-Progress is a status label until all lines are checked
 * (which auto-promotes to ready). Tickets with zero lines may still advance in_progress → ready.
 */
export function canClickKitchenAdvance(
  status: PosKitchenTicketStatus,
  lines: readonly { is_done: boolean }[],
): boolean {
  if (status === "new") return true;
  if (status === "in_progress") return lines.length === 0;
  if (status === "ready") return lines.length === 0 || lines.every((l) => l.is_done);
  return false;
}

