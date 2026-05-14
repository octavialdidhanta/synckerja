import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { getPiutangRemaining } from '../utils/piutangFilter';
import type { SalesActivity } from '@/shared/hooks/organized/sales';

type PiutangTableFooterProps = {
  totalActivities: number;
  filteredRows: SalesActivity[];
};

export function PiutangTableFooter({ totalActivities, filteredRows }: PiutangTableFooterProps) {
  const filtered = filteredRows.length;
  const totalRemaining = filteredRows.reduce((s, r) => s + Math.max(0, getPiutangRemaining(r)), 0);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Menampilkan {filtered} dari {totalActivities} aktivitas
        </span>
        <span className="text-xs text-muted-foreground/80">Total sisa: {formatToRupiah(totalRemaining)}</span>
      </div>
    </div>
  );
}
