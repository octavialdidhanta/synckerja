import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import { getPiutangRemaining } from '../utils/piutangFilter';

type PiutangMetricsCardsProps = {
  rows: SalesActivity[];
};

export function PiutangMetricsCards({ rows }: PiutangMetricsCardsProps) {
  const totalRemaining = rows.reduce((s, r) => s + Math.max(0, getPiutangRemaining(r)), 0);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-border bg-card p-2.5 shadow-sm">
        <div className="text-xs text-muted-foreground">Aktivitas (filter)</div>
        <div className="text-lg font-semibold tabular-nums">{rows.length}</div>
      </div>
      <div className="rounded-md border border-border bg-card p-2.5 shadow-sm">
        <div className="text-xs text-muted-foreground">Total sisa piutang</div>
        <div className="text-lg font-semibold tabular-nums">{formatToRupiah(totalRemaining)}</div>
      </div>
    </div>
  );
}
