import type { SalesActivity } from '@/shared/hooks/organized/sales';
import { getPiutangRemaining } from '../utils/piutangFilter';

export type PiutangMetrics = {
  totalRemaining: number;
  totalPaid: number;
  activityCount: number;
};

/** Ringkasan metrik piutang — dipakai desktop (`PiutangOverviewPanel`) & mobile carousel. */
export function computePiutangMetrics(filteredRows: SalesActivity[]): PiutangMetrics {
  return {
    totalRemaining: filteredRows.reduce((s, r) => s + Math.max(0, getPiutangRemaining(r)), 0),
    totalPaid: filteredRows.reduce((s, r) => s + Number(r.total_paid_amount ?? 0), 0),
    activityCount: filteredRows.length,
  };
}
