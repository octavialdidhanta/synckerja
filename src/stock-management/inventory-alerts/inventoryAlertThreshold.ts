export type InventoryAlertStatus = "out" | "low";

/** Mirror of DB `inventory_alert_status_from_stock`. */
export function inventoryAlertStatusFromStock(args: {
  inStock: number;
  alertEnabled: boolean;
  alertAt: number | null;
}): InventoryAlertStatus | null {
  const qty = Number.isFinite(args.inStock) ? args.inStock : 0;
  if (qty <= 0) return "out";
  if (
    args.alertEnabled &&
    args.alertAt != null &&
    Number.isFinite(args.alertAt) &&
    qty <= args.alertAt
  ) {
    return "low";
  }
  return null;
}

/**
 * Mirror of DB `did_cross_inventory_alert_threshold`.
 * Returns the new status only when stock newly enters low or out.
 */
export function didCrossInventoryAlertThreshold(args: {
  prevInStock: number;
  nextInStock: number;
  alertEnabled: boolean;
  alertAt: number | null;
}): InventoryAlertStatus | null {
  const was = inventoryAlertStatusFromStock({
    inStock: args.prevInStock,
    alertEnabled: args.alertEnabled,
    alertAt: args.alertAt,
  });
  const now = inventoryAlertStatusFromStock({
    inStock: args.nextInStock,
    alertEnabled: args.alertEnabled,
    alertAt: args.alertAt,
  });
  if (!now) return null;
  if (now === "out" && was !== "out") return "out";
  if (now === "low" && was !== "low") return "low";
  return null;
}
