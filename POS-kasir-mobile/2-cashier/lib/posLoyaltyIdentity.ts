import type { PosCashierCustomer, PosLoyaltyIdentity } from "./posCashierCustomer";
import { posLoyaltyIdentityFromCashier, posMemberPhoneLocalDigits } from "./posCashierCustomer";

export type PosLoyaltyOpenState = {
  phoneLocal: string;
  customer: PosLoyaltyIdentity | null;
  checked: boolean;
};

/** Prefill Check from a bill member. Session-only guests (no HP) do not look like a found member. */
export function loyaltyOpenStateFromCashier(
  cashier: PosCashierCustomer | null | undefined,
): PosLoyaltyOpenState {
  if (!cashier?.phone.trim()) {
    return { phoneLocal: "", customer: null, checked: false };
  }
  const phoneLocal = posMemberPhoneLocalDigits(cashier.phone);
  if (cashier.boundByPhone && cashier.leadId) {
    const customer = posLoyaltyIdentityFromCashier(cashier);
    return {
      phoneLocal,
      customer,
      checked: Boolean(customer),
    };
  }
  return { phoneLocal, customer: null, checked: false };
}

/** Skip rewards only. Identity stays the bill member, not an in-progress Check. */
export function loyaltySkipResult(billCustomer: PosLoyaltyIdentity | null): {
  customer: PosLoyaltyIdentity | null;
  reward: null;
} {
  return { customer: billCustomer, reward: null };
}
