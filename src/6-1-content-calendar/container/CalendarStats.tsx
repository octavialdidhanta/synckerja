import React from 'react';
import { Calendar, AlertCircle, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface CalendarStatsProps {
  monthlyStats: {
    total: number;
    red: number;
    orange: number;
    yellow: number;
    green: number;
    greenWithLate: number;
  };
}

export const CalendarStats: React.FC<CalendarStatsProps> = ({ monthlyStats }) => {
  const { t } = useAppTranslation();

  /* Order: total → content plan → production → posted (completed) */
  const statsCards = [
    {
      titleKey: 'contentCalendar.stats.totalContent',
      subtitleKey: 'contentCalendar.stats.allContentThisMonth',
      value: monthlyStats.total.toString(),
      icon: Calendar,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      titleKey: 'contentCalendar.legend.notApproved',
      subtitleKey: 'contentCalendar.stats.notApprovedSubtitle',
      value: monthlyStats.red.toString(),
      icon: AlertCircle,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      titleKey: 'contentCalendar.legend.contentPlanApproved',
      subtitleKey: 'contentCalendar.stats.contentPlanApprovedSubtitle',
      value: monthlyStats.orange.toString(),
      icon: Clock,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    {
      titleKey: 'contentCalendar.legend.productionApproved',
      subtitleKey: 'contentCalendar.stats.productionApprovedSubtitle',
      value: monthlyStats.yellow.toString(),
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    {
      titleKey: 'contentCalendar.legend.completed',
      subtitleKey: 'contentCalendar.stats.completedSubtitle',
      value: monthlyStats.green.toString(),
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      titleKey: 'contentCalendar.legend.completedLate',
      subtitleKey: 'contentCalendar.stats.completedLateSubtitle',
      value: monthlyStats.greenWithLate.toString(),
      icon: CheckCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-1.5">
      {statsCards.map((stat, index) => (
        <div key={index} className={`${stat.bgColor} ${stat.borderColor} border rounded-md p-4 flex flex-col`}>
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h3 className="text-sm font-medium text-gray-900">{t(stat.titleKey)}</h3>
            <stat.icon className={`w-5 h-5 ${stat.iconColor} flex-shrink-0`} />
          </div>
          
          <div className="flex flex-col flex-1 justify-end">
            <div className="text-2xl font-bold text-gray-900 text-left">{stat.value}</div>
            <div className="text-xs text-gray-600 text-left mt-1">{t(stat.subtitleKey)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
