import type { KitchenFireBySalesType } from "./kitchenFirePolicy";
import { resolveKitchenSalesTypeBucket } from "./kitchenSalesTypeBucket";

export type ShouldAutoDoneKitchenOnPayInput = {
  /** Session had KDS tickets before this pay event (save-bill flow). */
  hadKitchenTicketsBeforePay: boolean;
  /** Session was open (not created paid-only on this pay). */
  sessionWasOpenBeforePay: boolean;
  salesTypeLabel: string | null | undefined;
  settings: KitchenFireBySalesType;
};

/**
 * Pay-at-table (save bill first): auto-done on pay.
 * Pay-first (fire on this pay): keep KDS active for kitchen.
 */
export function shouldAutoDoneKitchenOnPay(
  input: ShouldAutoDoneKitchenOnPayInput,
): boolean {
  if (input.hadKitchenTicketsBeforePay) return true;

  const bucket = resolveKitchenSalesTypeBucket(input.salesTypeLabel);
  if (bucket === "dine_in" && input.sessionWasOpenBeforePay) return true;

  return false;
}
