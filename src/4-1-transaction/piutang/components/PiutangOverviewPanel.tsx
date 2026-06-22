import { useMemo } from 'react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import type { PiutangVerificationAggregate } from '../types/piutang.types';
import {
  computePiutangMetrics,
  findTopPiutangClientByRemaining,
} from '../shared/piutangMetrics';
import { getPiutangRemaining } from '../utils/piutangFilter';

type PiutangOverviewPanelProps = {
  filteredRows: SalesActivity[];
  verificationByActivity: ReadonlyMap<string, PiutangVerificationAggregate>;
};

function SummaryRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold text-foreground ${valueClassName ?? ''}`}>{value}</span>
    </div>
  );
}

/** Ringkasan detail di sidebar — breakdown status, verifikasi, dan klien terbesar. */
export function PiutangOverviewPanel({
  filteredRows,
  verificationByActivity,
}: PiutangOverviewPanelProps) {
  const { t } = useAppTranslation();
  const metrics = useMemo(
    () => computePiutangMetrics(filteredRows, verificationByActivity),
    [filteredRows, verificationByActivity],
  );
  const topClient = useMemo(() => findTopPiutangClientByRemaining(filteredRows), [filteredRows]);

  const avgOpenRemaining = useMemo(() => {
    if (metrics.openCount <= 0) return 0;
    const openTotal = filteredRows.reduce((sum, row) => {
      const remaining = Math.max(0, getPiutangRemaining(row));
      return sum + remaining;
    }, 0);
    return openTotal / metrics.openCount;
  }, [filteredRows, metrics.openCount]);

  const collectionPercent = Math.min(100, Math.max(0, metrics.collectionRate));

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            {t('incomes.piutang.summary.collectionProgress', 'Collection progress')}
          </span>
          <span className="font-semibold tabular-nums text-brand-blue">
            {collectionPercent.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand-blue transition-all"
            style={{ width: `${collectionPercent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('incomes.piutang.summary.collectedOfContract', '{{paid}} of {{contract}}', {
            paid: formatToRupiah(metrics.totalPaid),
            contract: formatToRupiah(metrics.totalContract),
          })}
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium text-foreground">
          {t('incomes.piutang.summary.statusBreakdown', 'Status breakdown')}
        </p>
        <SummaryRow
          label={t('incomes.piutang.summary.openContracts', 'Open contracts')}
          value={String(metrics.openCount)}
        />
        <SummaryRow
          label={t('incomes.piutang.summary.settledContracts', 'Settled contracts')}
          value={String(metrics.settledCount)}
        />
        <SummaryRow
          label={t('incomes.piutang.summary.avgOpenRemaining', 'Avg. open remaining')}
          value={formatToRupiah(avgOpenRemaining)}
        />
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium text-foreground">
          {t('incomes.piutang.summary.verificationBreakdown', 'Verification')}
        </p>
        <SummaryRow
          label={t('incomes.piutang.verification.approved', 'OK')}
          value={String(metrics.approvedVerificationCount)}
          valueClassName="text-green-600"
        />
        <SummaryRow
          label={t('incomes.piutang.verification.unchecked', 'Not checked')}
          value={String(metrics.pendingVerificationCount)}
          valueClassName="text-amber-600"
        />
        <SummaryRow
          label={t('incomes.piutang.verification.rejected', 'Rejected')}
          value={String(metrics.rejectedVerificationCount)}
          valueClassName="text-brand-red"
        />
      </div>

      {topClient ? (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">
            {t('incomes.piutang.summary.largestRemaining', 'Largest remaining')}
          </p>
          <p className="text-sm font-semibold text-foreground">{topClient.name}</p>
          <p className="text-xs tabular-nums text-brand-blue">{formatToRupiah(topClient.remaining)}</p>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-border pt-3">
        <SummaryRow
          label={t('incomes.piutang.summary.filteredActivities', 'Filtered activities')}
          value={String(metrics.activityCount)}
        />
        <SummaryRow
          label={t('incomes.piutang.summary.totalRemaining', 'Total remaining receivables')}
          value={formatToRupiah(metrics.totalRemaining)}
          valueClassName="text-brand-blue"
        />
        <SummaryRow
          label={t('incomes.piutang.summary.totalPaid', 'Total paid (filter)')}
          value={formatToRupiah(metrics.totalPaid)}
          valueClassName="text-green-600"
        />
      </div>
    </div>
  );
}
