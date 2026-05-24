import type { Debt } from '../types';
import { effectiveOutstandingBalance } from './resolveDebtDisplay';

/** Debts that can receive a payment (same rules as DebtPaymentModal). */
export function getPayableDebts(debts: Debt[]): Debt[] {
  return debts.filter((debt) => {
    if (debt.status !== 'active') return false;
    const remainingToPay = effectiveOutstandingBalance(debt);
    const hasInterest = (debt.total_interest ?? 0) > 0;
    return remainingToPay > 0 || hasInterest;
  });
}
