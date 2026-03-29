import React from 'react';
import { Calendar, Clock, CheckCircle, Users } from 'lucide-react';

interface Interviewee {
  id: string;
  status: string;
  interview_date?: string;
}

interface IntervieweesMetricsCardsProps {
  interviewees?: Interviewee[];
}

export const IntervieweesMetricsCards = ({ 
  interviewees = []
}: IntervieweesMetricsCardsProps) => {
  const totalInterviews = interviewees.length;
  const scheduledInterviews = interviewees.filter(i => i.status === 'scheduled').length;
  const completedInterviews = interviewees.filter(i => i.status === 'completed').length;
  
  // Calculate this week's interviews
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const thisWeekInterviews = interviewees.filter(i => {
    if (!i.interview_date) return false;
    const interviewDate = new Date(i.interview_date);
    return interviewDate >= startOfWeek && interviewDate <= today;
  }).length;

  const statsCards = [
    {
      title: 'Total Interviews',
      value: totalInterviews.toString(),
      subtitle: 'All interviews',
      icon: Users,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Scheduled',
      value: scheduledInterviews.toString(),
      subtitle: 'Upcoming',
      icon: Calendar,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    {
      title: 'This Week',
      value: thisWeekInterviews.toString(),
      subtitle: 'Scheduled',
      icon: Clock,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      title: 'Completed',
      value: completedInterviews.toString(),
      subtitle: 'Finished',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    }
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {statsCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="bg-white border rounded-lg p-3 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-600 mb-1 truncate">{card.title}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{card.subtitle}</p>
              </div>
              <div className={`p-2 rounded-md ${card.bgColor} ml-2 flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
