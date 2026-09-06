import {
  isOptionalCustomerEmailOk,
  isValidCustomerEmail,
  normalizeOptionalCustomerEmail,
} from "@/5-2-customer-visits/lib/isValidCustomerEmail";

/** POS Add Customer / cart email helpers (shared validation with receipt). */
export {
  isValidCustomerEmail as isValidPosCustomerEmail,
  isOptionalCustomerEmailOk,
  normalizeOptionalCustomerEmail,
};

export function isValidPosReceiptEmail(email: string): boolean {
  return isValidCustomerEmail(email);
}
