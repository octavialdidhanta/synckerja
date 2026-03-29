
import { User, Calendar, UserCheck, UserX } from 'lucide-react';

export const ApplicationsMetricsCards = () => {
  // Mock data for demonstration - in real app this would come from props or API
  const applications = [
    {
      id: '1',
      candidateName: 'John Doe',
      email: 'john.doe@email.com',
      position: 'Frontend Developer',
      appliedDate: '2025-01-10',
      status: 'pending',
      score: '85/100',
      hasCV: true
    },
    {
      id: '2',
      candidateName: 'Jane Smith',
      email: 'jane.smith@email.com',
      position: 'UI/UX Designer',
      appliedDate: '2025-01-09',
      status: 'reviewed',
      score: '92/100',
      hasCV: true
    },
    {
      id: '3',
      candidateName: 'Mike Johnson',
      email: 'mike.johnson@email.com',
      position: 'Backend Developer',
      appliedDate: '2025-01-08',
      status: 'accepted',
      score: '78/100',
      hasCV: true
    }
  ];

  const metrics = [
    {
      title: 'Total Applications',
      count: applications.length,
      subtitle: 'Not specified',
      icon: User,
      accentColor: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Due This Week',
      count: 0,
      subtitle: 'Not specified',
      icon: Calendar,
      accentColor: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600'
    },
    {
      title: 'Reviewed',
      count: applications.filter(app => app.status === 'reviewed').length,
      subtitle: 'Not specified',
      icon: UserCheck,
      accentColor: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600'
    },
    {
      title: 'Accepted',
      count: applications.filter(app => app.status === 'accepted').length,
      subtitle: 'Not specified',
      icon: UserX,
      accentColor: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    }
  ];

  return (
    <>
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        
        return (
          <div key={index} className="bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200/50 p-2 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden">
            {/* Accent line */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${metric.accentColor}`}></div>
            
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/10 to-blue-50/10 pointer-events-none"></div>
            
            {/* Content */}
            <div className="relative px-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600 mb-1 truncate">{metric.title}</p>
                  <div className="space-y-0.5">
                    <p className="text-2xl font-bold leading-none text-slate-900">{metric.count}</p>
                    <p className="text-xs font-medium leading-tight text-slate-500">
                      {metric.subtitle}
                    </p>
                  </div>
                </div>
                <div className={`p-1.5 rounded-md ${metric.bgColor} ml-2`}>
                  <Icon className={`h-3.5 w-3.5 ${metric.textColor}`} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
