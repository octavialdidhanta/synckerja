import React from 'react';
import { Activity, TrendingUp, CheckCircle, DollarSign } from 'lucide-react';
import {
  isOngoingSalesActivityStatus,
  isWonSalesActivityStatus,
} from '../utils/salesActivitiesFilterUtils';

interface SalesActivitiesMetricsCardsProps {
  activities: any[];
}

export const SalesActivitiesMetricsCards = ({ activities }: SalesActivitiesMetricsCardsProps) => {
  const totalActivities = activities.length;

  const ongoingActivities = activities.filter((a) => isOngoingSalesActivityStatus(a.status)).length;
  const closedWonActivities = activities.filter((a) => isWonSalesActivityStatus(a.status)).length;
  const totalRevenue = activities
    .filter((a) => isWonSalesActivityStatus(a.status))
    .reduce((sum, a) => sum + (a.total_amount || a.amount || 0), 0);

  const statsCards = [
    {
      title: 'Total Activities',
      value: totalActivities.toString(),
      subtitle: 'All activities',
      icon: Activity,
      iconColor: 'text-brand-blue',
      bgColor: 'bg-brand-blue-soft',
      borderColor: 'border-brand-blue/25'
    },
    {
      title: 'Ongoing',
      value: ongoingActivities.toString(),
      subtitle: 'In progress',
      icon: TrendingUp,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    {
      title: 'Closed Won',
      value: closedWonActivities.toString(),
      subtitle: 'Successful deals',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Total Revenue',
      value: totalRevenue.toLocaleString('id-ID'),
      subtitle: 'From closed deals',
      icon: DollarSign,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
      {statsCards.map((stat, index) => (
        <div key={index} className={`${stat.bgColor} ${stat.borderColor} border rounded-md p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">{stat.title}</h3>
            <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
          </div>
          
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-600">{stat.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
