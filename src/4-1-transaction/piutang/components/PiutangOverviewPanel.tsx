import { DollarSign, Wallet } from 'lucide-react';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import { getPiutangRemaining } from '../utils/piutangFilter';

type PiutangOverviewPanelProps = {
  filteredRows: SalesActivity[];
};

/** Ringkasan di kolom kanan — ritme visual mengikuti kartu ringkas di `IncomeTransactionOverview`. */
export function PiutangOverviewPanel({ filteredRows }: PiutangOverviewPanelProps) {
  const totalRemaining = filteredRows.reduce((s, r) => s + Math.max(0, getPiutangRemaining(r)), 0);
  const totalPaid = filteredRows.reduce((s, r) => s + Number(r.total_paid_amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg bg-brand-blue/10 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-brand-blue">Total sisa piutang</p>
              <p className="text-lg font-bold text-brand-blue">{formatToRupiah(totalRemaining)}</p>
            </div>
            <DollarSign className="h-5 w-5 text-brand-blue" />
          </div>
        </div>

        <div className="rounded-lg bg-green-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-800">Total terbayar (filter)</p>
              <p className="text-lg font-bold text-green-900">{formatToRupiah(totalPaid)}</p>
            </div>
            <Wallet className="h-5 w-5 text-green-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
