import type { SalesActivity } from '@/shared/hooks/organized/sales';
import type { PiutangVerificationAggregate } from '../types/piutang.types';
import { getPiutangRemaining } from '../utils/piutangFilter';

export type PiutangMetrics = {
  totalRemaining: number;
  totalPaid: number;
  totalContract: number;
  activityCount: number;
  openCount: number;
  settledCount: number;
  collectionRate: number;
  pendingVerificationCount: number;
  rejectedVerificationCount: number;
  approvedVerificationCount: number;
};

export type PiutangTopClient = {
  name: string;
  remaining: number;
};

/** Ringkasan metrik piutang — dipakai kartu atas, sidebar, & mobile carousel. */
export function computePiutangMetrics(
  filteredRows: SalesActivity[],
  verificationByActivity?: ReadonlyMap<string, PiutangVerificationAggregate>,
): PiutangMetrics {
  let totalRemaining = 0;
  let totalPaid = 0;
  let totalContract = 0;
  let openCount = 0;
  let settledCount = 0;
  let pendingVerificationCount = 0;
  let rejectedVerificationCount = 0;
  let approvedVerificationCount = 0;

  for (const row of filteredRows) {
    const remaining = Math.max(0, getPiutangRemaining(row));
    totalRemaining += remaining;
    totalPaid += Number(row.total_paid_amount ?? 0);
    totalContract += Number(row.total_amount ?? 0);

    if (remaining > 0) openCount += 1;
    else settledCount += 1;

    if (verificationByActivity) {
      const aggregate = verificationByActivity.get(row.id);
      if (aggregate === 'unchecked') pendingVerificationCount += 1;
      else if (aggregate === 'rejected') rejectedVerificationCount += 1;
      else if (aggregate === 'approved') approvedVerificationCount += 1;
    }
  }

  const collectionRate = totalContract > 0 ? (totalPaid / totalContract) * 100 : 0;

  return {
    totalRemaining,
    totalPaid,
    totalContract,
    activityCount: filteredRows.length,
    openCount,
    settledCount,
    collectionRate,
    pendingVerificationCount,
    rejectedVerificationCount,
    approvedVerificationCount,
  };
}

/** Klien dengan sisa piutang terbesar pada filter saat ini. */
export function findTopPiutangClientByRemaining(
  filteredRows: SalesActivity[],
): PiutangTopClient | null {
  let top: PiutangTopClient | null = null;

  for (const row of filteredRows) {
    const remaining = Math.max(0, getPiutangRemaining(row));
    if (remaining <= 0) continue;
    const name = String(row.client_name ?? '—').trim() || '—';
    if (!top || remaining > top.remaining) {
      top = { name, remaining };
    }
  }

  return top;
}
