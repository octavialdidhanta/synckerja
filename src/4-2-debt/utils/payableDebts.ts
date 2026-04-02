import type { Debt } from '../types';

/** Debts that can receive a payment (same rules as DebtPaymentModal). */
export function getPayableDebts(debts: Debt[]): Debt[] {
  return debts.filter((debt) => {
    if (debt.status !== 'active') return false;
    const fallback = Math.max(0, debt.debt_amount - (debt.paid_amount ?? 0));
    const remainingToPay =
      debt.remaining_debt != null && debt.remaining_debt !== undefined
        ? debt.remaining_debt > 0
          ? debt.remaining_debt
          : fallback > 0
            ? fallback
            : 0
        : fallback;
    const hasInterest = (debt.total_interest ?? 0) > 0;
    return remainingToPay > 0 || hasInterest;
  });
}
