
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Receipt, Calendar, Target } from 'lucide-react';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useIncomeMetrics } from '../hooks';

export const IncomeMetricsCards = () => {
  const { data: metrics, isLoading } = useIncomeMetrics();

  if (isLoading) {
    return (
      <>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-md border border-gray-200/50 p-2.5 shadow-sm animate-pulse">
            <div className="flex items-center justify-between mb-1">
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded mb-1"></div>
                <div className="h-5 bg-gray-200 rounded mb-1"></div>
                <div className="h-2 bg-gray-200 rounded"></div>
              </div>
              <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
            </div>
          </div>
        ))}
      </>
    );
  }

  const isGrowthPositive = (metrics?.growthPercentage || 0) >= 0;

  const metricsData = [
    {
      title: 'This Month Revenue',
      value: metrics?.currentMonthTotal || 0,
      subtitle: `${Math.abs(metrics?.growthPercentage || 0).toFixed(1)}% from last month`,
      icon: DollarSign,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      formatValue: true
    },
    {
      title: 'Total Transactions',
      value: metrics?.totalTransactions || 0,
      subtitle: `${metrics?.currentMonthTransactionCount || 0} this month`,
      icon: Receipt,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      formatValue: false
    },
    {
      title: 'This Year Revenue',
      value: metrics?.yearTotal || 0,
      subtitle: 'Year-to-date income',
      icon: Calendar,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
      formatValue: true
    },
    {
      title: 'Monthly Average',
      value: (metrics?.yearTotal || 0) / (new Date().getMonth() + 1),
      subtitle: 'Based on year-to-date',
      icon: Target,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50',
      formatValue: true
    }
  ];

  return (
    <>
      {metricsData.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div key={index} className="bg-white rounded-md border border-gray-200/50 p-2.5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-500 mb-0.5">{metric.title}</div>
                <div className="text-xl font-bold text-gray-900">
                  {metric.formatValue ? formatToRupiah(metric.value) : metric.value}
                </div>
                <div className="text-xs text-gray-500">
                  {metric.subtitle}
                </div>
              </div>
              <div className={`p-1.5 rounded-md ${metric.iconBg} ml-2`}>
                <Icon className={`h-3.5 w-3.5 ${metric.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
