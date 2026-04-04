import React from 'react';
import { Calendar, Clock, Users, CheckCircle } from 'lucide-react';
import { useVisitScheduling } from '@/shared/hooks/organized/sales';

interface VisitSchedulingMetricsCardsProps {
  visits?: any[];
}

export const VisitSchedulingMetricsCards = ({ visits: propVisits }: VisitSchedulingMetricsCardsProps) => {
  const { visits: hookVisits = [] } = useVisitScheduling();
  const visits = propVisits || hookVisits;

  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const todayVisits = visits.filter(visit => visit.visit_date === today).length;
  const weekVisits = visits.filter(visit => visit.visit_date >= weekStartStr).length;
  const scheduledVisits = visits.filter(visit => visit.status === 'scheduled').length;
  const completedVisits = visits.filter(visit => visit.status === 'completed').length;

  const statsCards = [
    {
      title: "Today's Visits",
      value: todayVisits.toString(),
      subtitle: 'Scheduled today',
      icon: Calendar,
      iconColor: 'text-brand-blue',
      bgColor: 'bg-brand-blue-soft',
      borderColor: 'border-brand-blue/25'
    },
    {
      title: 'This Week',
      value: weekVisits.toString(),
      subtitle: 'Scheduled this week',
      icon: Clock,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Scheduled',
      value: scheduledVisits.toString(),
      subtitle: 'Active visits',
      icon: Users,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      title: 'Completed',
      value: completedVisits.toString(),
      subtitle: 'Finished visits',
      icon: CheckCircle,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
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
