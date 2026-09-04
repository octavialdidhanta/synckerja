/**
 * Prefix for cooked F&B refund reasons stored on sales_activities.refund_reason.
 * V1 does not insert catalog_stock_movements of type `waste`.
 */
export function kitchenWasteNote(reason: string): string {
  return `Kitchen waste: ${reason.trim()}`;
}
