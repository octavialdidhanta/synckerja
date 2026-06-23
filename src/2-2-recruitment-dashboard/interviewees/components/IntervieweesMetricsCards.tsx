import React from 'react';
import { Calendar, Clock, CheckCircle, Users } from 'lucide-react';

interface IntervieweeMetric {
  id: string;
  interview_status?: string;
  interview_date?: string;
  total_reviews?: number;
  average_score?: number;
}

interface IntervieweesMetricsCardsProps {
  interviewees?: IntervieweeMetric[];
}

export const IntervieweesMetricsCards = ({
  interviewees = [],
}: IntervieweesMetricsCardsProps) => {
  const totalInterviews = interviewees.length;
  const scheduledInterviews = interviewees.filter((i) => i.interview_status === 'scheduled').length;
  const completedInterviews = interviewees.filter(
    (i) =>
      i.interview_status === 'completed' ||
      (i.total_reviews != null && i.total_reviews > 0) ||
      (i.average_score != null && i.average_score > 0),
  ).length;

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const thisWeekInterviews = interviewees.filter((i) => {
    if (!i.interview_date) return false;
    const interviewDate = new Date(i.interview_date);
    return interviewDate >= startOfWeek && interviewDate <= today;
  }).length;

  const statsCards = [
    {
      title: 'Total Candidates',
      value: totalInterviews.toString(),
      subtitle: 'Ready for interview',
      icon: Users,
      iconColor: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      borderColor: 'border-brand-blue/30',
    },
    {
      title: 'Scheduled',
      value: scheduledInterviews.toString(),
      subtitle: 'Upcoming interviews',
      icon: Calendar,
      iconColor: 'text-brand-blue-deep',
      bgColor: 'bg-brand-blue-soft',
      borderColor: 'border-brand-blue/25',
    },
    {
      title: 'This Week',
      value: thisWeekInterviews.toString(),
      subtitle: 'Interview dates',
      icon: Clock,
      iconColor: 'text-brand-blue-on-soft',
      bgColor: 'bg-brand-blue/15',
      borderColor: 'border-brand-blue/20',
    },
    {
      title: 'Interviewed',
      value: completedInterviews.toString(),
      subtitle: 'With reviews or done',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
      {statsCards.map((stat, index) => (
        <div key={index} className={`${stat.bgColor} ${stat.borderColor} rounded-md border p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">{stat.title}</h3>
            <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
