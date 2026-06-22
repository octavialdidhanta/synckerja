import { DollarSign, Receipt, Calendar, Target } from 'lucide-react';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useIncomeMetrics } from '../hooks';

export const IncomeMetricsCards = () => {
  const { data: metrics, isLoading } = useIncomeMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-md border border-brand-blue/30 bg-brand-blue/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-5 w-5 rounded bg-muted" />
            </div>
            <div className="h-8 w-20 rounded bg-muted" />
            <div className="mt-1 h-3 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const metricsData = [
    {
      title: 'This Month Revenue',
      value: metrics?.currentMonthTotal || 0,
      subtitle: `${Math.abs(metrics?.growthPercentage || 0).toFixed(1)}% from last month`,
      icon: DollarSign,
      iconColor: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      borderColor: 'border-brand-blue/30',
      formatValue: true,
    },
    {
      title: 'Total Transactions',
      value: metrics?.totalTransactions || 0,
      subtitle: `${metrics?.currentMonthTransactionCount || 0} this month`,
      icon: Receipt,
      iconColor: 'text-brand-blue-deep',
      bgColor: 'bg-brand-blue-soft',
      borderColor: 'border-brand-blue/25',
      formatValue: false,
    },
    {
      title: 'This Year Revenue',
      value: metrics?.yearTotal || 0,
      subtitle: 'Year-to-date income',
      icon: Calendar,
      iconColor: 'text-brand-blue-on-soft',
      bgColor: 'bg-brand-blue/15',
      borderColor: 'border-brand-blue/20',
      formatValue: true,
    },
    {
      title: 'Monthly Average',
      value: (metrics?.yearTotal || 0) / (new Date().getMonth() + 1),
      subtitle: 'Based on year-to-date',
      icon: Target,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      formatValue: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
      {metricsData.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className={`${metric.bgColor} ${metric.borderColor} rounded-md border p-4`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{metric.title}</h3>
              <Icon className={`h-5 w-5 shrink-0 ${metric.iconColor}`} />
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {metric.formatValue ? formatToRupiah(metric.value) : metric.value}
              </div>
              <div className="text-xs text-muted-foreground">{metric.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
