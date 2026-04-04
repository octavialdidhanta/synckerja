/**
 * Meta Instagram PSID (Page-Scoped ID) is numeric only, typically 15–20 digits.
 * WhatsApp customer_wa_id is E.164 phone (e.g. 628123456789).
 */
export function isLikelyInstagramId(customerWaId: string | null | undefined): boolean {
  if (customerWaId == null || customerWaId.trim() === '') return false;
  const s = customerWaId.trim();
  return /^[0-9]{15,}$/.test(s) && !s.startsWith('0');
}
