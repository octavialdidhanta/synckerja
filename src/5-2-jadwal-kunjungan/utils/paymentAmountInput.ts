/** Digits only, then Indonesian-style thousand separators (.) for display while typing. */
export function formatPaymentAmountThousands(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parsePaymentAmountThousands(value: string): number {
  return parseFloat(value.replace(/\D/g, '')) || 0;
}
