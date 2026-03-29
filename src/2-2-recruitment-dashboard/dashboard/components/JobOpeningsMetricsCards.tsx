import React from 'react';
import { Briefcase, Clock, FileText, CheckCircle } from 'lucide-react';
import { JobOpening } from '@/2-2-recruitment-dashboard/job-openings/hooks/jobOpeningTypes';

interface JobOpeningsMetricsCardsProps {
  jobOpenings?: JobOpening[];
}

export const JobOpeningsMetricsCards = ({ 
  jobOpenings = []
}: JobOpeningsMetricsCardsProps) => {
  const totalJobs = jobOpenings.length;
  const activeJobs = jobOpenings.filter(job => job.status === 'active').length;
  const draftJobs = jobOpenings.filter(job => job.status === 'draft').length;
  const totalApplications = jobOpenings.reduce((sum, job) => sum + (job.submissions || 0), 0);

  const statsCards = [
    {
      title: 'Total Job Openings',
      value: totalJobs.toString(),
      subtitle: 'All positions',
      icon: Briefcase,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Active Positions',
      value: activeJobs.toString(),
      subtitle: 'Currently open',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Draft Positions',
      value: draftJobs.toString(),
      subtitle: 'In draft',
      icon: FileText,
      iconColor: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      title: 'Total Applications',
      value: totalApplications.toString(),
      subtitle: 'All applications',
      icon: Clock,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
      {statsCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className={`bg-white rounded-md border ${card.borderColor} p-3 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">{card.title}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.subtitle}</p>
              </div>
              <div className={`p-2 rounded-md ${card.bgColor}`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
