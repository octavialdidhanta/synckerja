import type { KitchenFireTrigger } from "./kitchenFirePolicy";

/** Print still follows printer prefs; recipe stock commits on every KDS fire. */
export function shouldPrintKitchenTicketOnFire(
  event: KitchenFireTrigger,
  printTicketOnPay: boolean,
): boolean {
  if (event === "on_pay") return printTicketOnPay;
  return !printTicketOnPay;
}
