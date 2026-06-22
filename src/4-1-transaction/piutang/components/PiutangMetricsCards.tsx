import { DollarSign, FileText, Percent, AlertCircle } from 'lucide-react';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import type { PiutangVerificationAggregate } from '../types/piutang.types';
import { computePiutangMetrics } from '../shared/piutangMetrics';

type PiutangMetricsCardsProps = {
  filteredRows: SalesActivity[];
  verificationByActivity: ReadonlyMap<string, PiutangVerificationAggregate>;
};

export function PiutangMetricsCards({
  filteredRows,
  verificationByActivity,
}: PiutangMetricsCardsProps) {
  const { t } = useAppTranslation();
  const metrics = computePiutangMetrics(filteredRows, verificationByActivity);

  const cards = [
    {
      title: t('incomes.piutang.metrics.totalRemaining', 'Total remaining'),
      value: formatToRupiah(metrics.totalRemaining),
      subtitle: t('incomes.piutang.metrics.openContracts', '{{count}} open contracts', {
        count: metrics.openCount,
      }),
      icon: DollarSign,
      iconColor: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      borderColor: 'border-brand-blue/30',
    },
    {
      title: t('incomes.piutang.metrics.totalContract', 'Total contract value'),
      value: formatToRupiah(metrics.totalContract),
      subtitle: t('incomes.piutang.metrics.paidAmount', '{{amount}} collected', {
        amount: formatToRupiah(metrics.totalPaid),
      }),
      icon: FileText,
      iconColor: 'text-brand-blue-deep',
      bgColor: 'bg-brand-blue-soft',
      borderColor: 'border-brand-blue/25',
    },
    {
      title: t('incomes.piutang.metrics.collectionRate', 'Collection rate'),
      value: `${metrics.collectionRate.toFixed(1)}%`,
      subtitle: t('incomes.piutang.metrics.settledCount', '{{count}} settled', {
        count: metrics.settledCount,
      }),
      icon: Percent,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      title: t('incomes.piutang.metrics.needsReview', 'Needs verification'),
      value: String(metrics.pendingVerificationCount + metrics.rejectedVerificationCount),
      subtitle: t('incomes.piutang.metrics.reviewBreakdown', '{{unchecked}} unchecked · {{rejected}} rejected', {
        unchecked: metrics.pendingVerificationCount,
        rejected: metrics.rejectedVerificationCount,
      }),
      icon: AlertCircle,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className={`${card.bgColor} ${card.borderColor} rounded-md border p-4`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{card.title}</h3>
              <Icon className={`h-5 w-5 shrink-0 ${card.iconColor}`} />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold tabular-nums text-foreground">{card.value}</div>
              <div className="text-xs text-muted-foreground">{card.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
