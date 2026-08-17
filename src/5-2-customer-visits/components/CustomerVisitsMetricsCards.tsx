import { Banknote, Calendar, CheckCircle, Store, UserX } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getLocalDateYmd } from '@/shared/lib/date/getLocalDateYmd';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { CustomerVisitRow } from '../lib/customerVisit.types';
import { todayCashSummary, todayPaidSummary } from '../lib/customerVisitSale';

type Props = {
  visits: CustomerVisitRow[];
  cashVisits?: CustomerVisitRow[];
};

export function CustomerVisitsMetricsCards({ visits, cashVisits }: Props) {
  const { t } = useAppTranslation();
  const today = getLocalDateYmd();
  const completed = visits.filter((v) => v.status === 'completed');
  const total = completed.length;
  const unmatched = completed.filter((v) => v.match_status === 'unmatched').length;
  const matchedLeadIds = new Set(
    completed
      .filter((v) => v.match_status === 'matched' && v.lead_id)
      .map((v) => v.lead_id as string),
  );
  const todayLeadIds = new Set(
    completed
      .filter((v) => v.visit_date === today && v.match_status === 'matched' && v.lead_id)
      .map((v) => v.lead_id as string),
  );
  const paidToday = todayPaidSummary(completed, today);
  const cashToday = todayCashSummary(cashVisits ?? visits, today);
  const todayHint =
    paidToday.count > 0
      ? t('customerVisits.metrics.todayPaidHint', '{{count}} paid · {{amount}}', {
          count: paidToday.count,
          amount: formatToRupiah(paidToday.total),
        })
      : t('customerVisits.metrics.todayHint', 'Unique matched people today');

  const cards = [
    {
      title: t('customerVisits.metrics.total', 'Total visits'),
      value: String(total),
      subtitle: t('customerVisits.metrics.totalHint', 'All check-in rows'),
      icon: Calendar,
      iconColor: 'text-brand-blue',
      bgColor: 'bg-brand-blue-soft',
      borderColor: 'border-brand-blue/25',
    },
    {
      title: t('customerVisits.metrics.today', 'Today'),
      value: String(todayLeadIds.size),
      subtitle: todayHint,
      icon: Store,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
    {
      title: t('customerVisits.metrics.cashToday', 'Cash today'),
      value: formatToRupiah(cashToday.total),
      subtitle: t('customerVisits.metrics.cashTodayHint', '{{count}} cash tickets · sales only, exclude float', {
        count: cashToday.count,
      }),
      icon: Banknote,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      title: t('customerVisits.metrics.matched', 'Matched'),
      value: String(matchedLeadIds.size),
      subtitle: t('customerVisits.metrics.matchedHint', 'Unique matched people'),
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      title: t('customerVisits.metrics.unmatched', 'Unmatched'),
      value: String(unmatched),
      subtitle: t('customerVisits.metrics.unmatchedHint', 'Shop log only'),
      icon: UserX,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.title} className={`${card.bgColor} ${card.borderColor} rounded-md border p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">{card.title}</h3>
            <card.icon className={`h-5 w-5 ${card.iconColor}`} />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-xs text-gray-600">{card.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
