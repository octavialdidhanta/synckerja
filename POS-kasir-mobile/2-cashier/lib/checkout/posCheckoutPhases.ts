/**
 * Checkout is split so Paying / Change never wait on Bluetooth.
 *
 * Critical path: money, seating, KDS ticket insert, and recipe stock must
 * succeed before Change. Failures here roll back the sale (cash/card).
 *
 * Side effects: after Change. Never roll back a committed sale. Bluetooth
 * work is serialized: kitchen tickets, then receipt.
 */

export const POS_CHECKOUT_CRITICAL_PHASES = [
  "custom_cash_in",
  "shift_stock_lead_activity_income",
  "pay_first_session_insert",
  "kitchen_ticket_insert",
  "session_close_or_update",
  "auto_done_existing_tickets",
  "synckerja_complete",
] as const;

export type PosCheckoutCriticalPhase = (typeof POS_CHECKOUT_CRITICAL_PHASES)[number];

export const POS_CHECKOUT_SIDE_EFFECT_PHASES = [
  "kitchen_ticket_print",
  "receipt_print",
] as const;

export type PosCheckoutSideEffectPhase = (typeof POS_CHECKOUT_SIDE_EFFECT_PHASES)[number];
