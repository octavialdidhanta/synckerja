import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";

export type ResolvePosPostOutletPathInput = {
  canCharge: boolean;
  canKitchenDisplay: boolean;
};

/**
 * Home route after outlet select (and fallback when a route is denied).
 * Charge wins; kitchen-only staff land on KDS shell.
 */
export function resolvePosPostOutletPath(
  input: ResolvePosPostOutletPathInput,
): string {
  if (input.canCharge) return POS_AUTH_PATHS.cashier;
  if (input.canKitchenDisplay) return POS_AUTH_PATHS.kitchen;
  return POS_AUTH_PATHS.selectOutlet;
}
