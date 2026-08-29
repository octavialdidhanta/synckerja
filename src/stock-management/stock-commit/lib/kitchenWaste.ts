/**
 * Placeholder for post-production kitchen voids (Fase B+ waste bucket).
 * V1 uses reverse_catalog_kitchen_commit (adjustment) instead.
 */
export function kitchenWasteNote(reason: string): string {
  return `Kitchen waste: ${reason.trim()}`;
}
