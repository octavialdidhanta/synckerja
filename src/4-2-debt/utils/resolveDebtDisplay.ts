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

function hasCreditLineTracking(debt: DebtLike): boolean {
  const lim = debt.limit_amount ?? 0;
  return lim > 0 && debt.available_limit != null && Number.isFinite(debt.available_limit);
}

/**
 * Sisa hutang / plafon terpakai untuk UI (kolom Debt, total, modal bayar).
 *
 * - Kartu kredit & sejenis (ada plafon + available_limit): `limit_amount − available_limit`.
 *   Pembayaran menaikkan available_limit; expense menurunkannya — paid_amount tidak dikurangkan lagi
 *   (menghindari double-count setelah edit debt yang men-set debt_amount = limit − available).
 * - Pinjaman Online: `debt_amount − paid_amount` (debt_amount = SUM expense, dipelihara trigger/RPC).
 * - Lainnya tanpa plafon: `debt_amount − paid_amount`.
 */
export function effectiveOutstandingBalance(debt: DebtLike): number {
  if (debt.debt_type === 'Pinjaman Online') {
    return Math.max(0, (debt.debt_amount ?? 0) - (debt.paid_amount ?? 0));
  }

  if (hasCreditLineTracking(debt)) {
    const lim = debt.limit_amount ?? 0;
    const avail = debt.available_limit ?? 0;
    return Math.max(0, lim - avail);
  }

  return Math.max(0, (debt.debt_amount ?? 0) - (debt.paid_amount ?? 0));
}

/**
 * Single source for debt row display (desktop + mobile).
 */
export function resolveDebtDisplay(debt: DebtLike): ResolvedDebtDisplay {
  const isOnlineLoan = debt.debt_type === 'Pinjaman Online';
  const lim = debt.limit_amount ?? 0;
  const remaining = effectiveOutstandingBalance(debt);

  if (isOnlineLoan) {
    const displayLimitAmount = debt.limit_amount;
    const displayAvailableLimit =
      debt.available_limit != null && Number.isFinite(debt.available_limit)
        ? Math.max(0, debt.available_limit)
        : Math.max(0, lim - remaining);
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
      displayDebtAmount: remaining,
      displayPaidAmount,
      displayInterest,
      utilization,
    };
  }

  const displayAvailableLimit = hasCreditLineTracking(debt)
    ? Math.max(0, debt.available_limit ?? 0)
    : Math.max(0, lim - remaining);
  const displayPaidAmount = debt.paid_amount ?? null;
  const utilization = calculateDebtUtilization(lim, remaining);

  return {
    displayLimitAmount: debt.limit_amount,
    displayAvailableLimit,
    displayDebtAmount: remaining,
    displayPaidAmount,
    displayInterest: null,
    utilization,
  };
}

/** Balance shown in "Debt" column — use for totals and "can pay" checks. */
export function debtDisplayBalance(debt: DebtLike): number {
  return resolveDebtDisplay(debt).displayDebtAmount;
}
