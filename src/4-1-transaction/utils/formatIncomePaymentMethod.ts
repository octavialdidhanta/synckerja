export function canonicalIncomePaymentMethod(raw: string | null | undefined): string | null {
  const method = String(raw ?? '').trim().toLowerCase();
  if (!method) return null;
  if (method === 'transfer' || method === 'bank transfer') return 'bank_transfer';
  if (method === 'digital_wallet') return 'e_wallet';
  return method;
}

export type IncomePaymentMethodLabels = {
  cash: string;
  bankTransfer: string;
  eWallet: string;
  creditCard: string;
  debitCard: string;
};

export function formatIncomePaymentMethodLabel(
  raw: string | null | undefined,
  labels: IncomePaymentMethodLabels,
  empty = '-',
): string {
  const canonical = canonicalIncomePaymentMethod(raw);
  if (!canonical) return empty;
  const map: Record<string, string> = {
    cash: labels.cash,
    bank_transfer: labels.bankTransfer,
    e_wallet: labels.eWallet,
    credit_card: labels.creditCard,
    debit_card: labels.debitCard,
  };
  return map[canonical] ?? String(raw).trim();
}
