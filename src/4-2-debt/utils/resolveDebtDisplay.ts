import type { Debt } from '../types';

export type DebtLike = Pick<
  Debt,
  | 'debt_type'
  | 'limit_amount'
  | 'available_limit'
  | 'debt_amount'
  | 'paid_amount'
  | 'remaining_debt'
  | 'total_interest'
>;

export interface ResolvedDebtDisplay {
  displayLimitAmount: number;
  displayAvailableLimit: number;
  displayDebtAmount: number;
  displayPaidAmount: number | null;
  displayInterest: number | null;
  utilization: number;
}

export function calculateDebtUtilization(limit: number, used: number): number {
  if (limit === 0) return 0;
  return Math.round((used / limit) * 100);
}

/**
 * Single source for debt row display (desktop + mobile).
 * Pinjaman Online: remaining-based (remaining_debt / debt_amount - paid).
 * Kartu kredit & lainnya: debt_amount di DB = total pemakaian (selaras SUM expense di dashboard);
 * sisa tagihan = remaining_debt (atau debt_amount - paid). Limit tersedia = plafon - sisa tagihan
 * (sama dengan available_limit yang dipelihara trigger, tidak memakai debt_amount mentah di kolom Debt).
 */
export function resolveDebtDisplay(debt: DebtLike): ResolvedDebtDisplay {
  const isOnlineLoan = debt.debt_type === 'Pinjaman Online';

  if (isOnlineLoan) {
    const remaining =
      debt.remaining_debt ?? Math.max(0, (debt.debt_amount ?? 0) - (debt.paid_amount ?? 0));
    const lim = debt.limit_amount ?? 0;
    const displayLimitAmount = debt.limit_amount;
    const displayAvailableLimit = Math.max(0, lim - remaining);
    const displayDebtAmount = remaining;
    const displayPaidAmount =
      debt.paid_amount !== undefined && debt.paid_amount !== null && debt.paid_amount > 0
        ? debt.paid_amount
        : null;
    const displayInterest =
      debt.total_interest != null && debt.total_interest > 0 ? debt.total_interest : null;
    const utilization =
      lim > 0 ? Math.min(100, Math.round((remaining / Math.max(lim, 1)) * 100)) : 0;

    return {
      displayLimitAmount,
      displayAvailableLimit,
      displayDebtAmount,
      displayPaidAmount,
      displayInterest,
      utilization,
    };
  }

  const lim = debt.limit_amount ?? 0;
  const remaining =
    debt.remaining_debt ?? Math.max(0, (debt.debt_amount ?? 0) - (debt.paid_amount ?? 0));
  const displayDebtAmount = remaining;
  const displayAvailableLimit = Math.max(0, lim - remaining);
  const displayPaidAmount = debt.paid_amount ?? null;
  const utilization = calculateDebtUtilization(lim, displayDebtAmount);

  return {
    displayLimitAmount: debt.limit_amount,
    displayAvailableLimit,
    displayDebtAmount,
    displayPaidAmount,
    displayInterest: null,
    utilization,
  };
}

/** Balance shown in "Debt" column — use for totals and "can pay" checks. */
export function debtDisplayBalance(debt: DebtLike): number {
  return resolveDebtDisplay(debt).displayDebtAmount;
}
