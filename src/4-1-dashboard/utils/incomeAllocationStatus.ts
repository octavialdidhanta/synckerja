/** Minimal shape for allocation completeness checks (table rows + update merge). */
export type IncomeAllocationCheckInput = {
  income_type_id?: string | null;
  category_id?: string | null;
  bank_account_id?: string | null;
};

function hasNonEmptyUuid(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0;
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
