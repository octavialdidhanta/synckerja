/** Minimal shape for allocation completeness checks (table rows + update merge). */
export type IncomeAllocationCheckInput = {
  income_type_id?: string | null;
  category_id?: string | null;
  bank_account_id?: string | null;
};

export type IncomeDepositCheckInput = IncomeAllocationCheckInput & {
  status?: string | null;
  deposit_confirmed_at?: string | null;
};

function hasNonEmptyUuid(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isIncomeDepositConfirmed(tx: Pick<IncomeDepositCheckInput, 'deposit_confirmed_at'>): boolean {
  return Boolean(tx.deposit_confirmed_at);
}

/** Status after edit: pending | deposited | completed | cancelled */
export function resolveIncomeTransactionStatus(
  tx: IncomeDepositCheckInput,
): 'pending' | 'deposited' | 'completed' | 'cancelled' {
  if (tx.status === 'cancelled') return 'cancelled';
  if (!isIncomeDepositConfirmed(tx)) return 'pending';
  if (isIncomeAllocationComplete(tx)) return 'completed';
  return 'deposited';
}

export function incomeStatusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'deposited':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

/** True when type, category, or bank account is still missing. */
export function isIncomeAllocationIncomplete(tx: IncomeAllocationCheckInput): boolean {
  return (
    !hasNonEmptyUuid(tx.income_type_id) ||
    !hasNonEmptyUuid(tx.category_id) ||
    !hasNonEmptyUuid(tx.bank_account_id)
  );
}

export function isIncomeAllocationComplete(tx: IncomeAllocationCheckInput): boolean {
  return !isIncomeAllocationIncomplete(tx);
}
