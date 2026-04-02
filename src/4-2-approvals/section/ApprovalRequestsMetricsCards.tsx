
import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { Clock, CheckCircle, XCircle, FileText } from 'lucide-react';

export const ApprovalRequestsMetricsCards = () => {
  const { data: requests = [] } = usePurchaseRequests();

  const metrics = {
    pending: requests.filter(r => r.status === 'pending_approval' || r.status === 'submitted').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    total: requests.length
  };

  const metricsData = [
    {
      title: 'Pending',
      value: metrics.pending,
      icon: Clock,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      accent: 'bg-amber-500'
    },
    {
      title: 'Approved',
      value: metrics.approved,
      icon: CheckCircle,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-50',
      accent: 'bg-green-500'
    },
    {
      title: 'Rejected',
      value: metrics.rejected,
      icon: XCircle,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
      accent: 'bg-red-500'
    },
    {
      title: 'Total',
      value: metrics.total,
      icon: FileText,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      accent: 'bg-blue-500'
    }
  ];

  return (
    <>
      {metricsData.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div 
            key={index}
            className="bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200/50 p-2 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden"
          >
            {/* Accent line */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${metric.accent}`}></div>
            
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/10 to-blue-50/10 pointer-events-none"></div>
            
            {/* Content */}
            <div className="relative px-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">{metric.title}</span>
                <div className={`p-1.5 rounded-md ${metric.iconBg}`}>
                  <Icon className={`h-3.5 w-3.5 ${metric.iconColor}`} />
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-2xl font-bold leading-none text-slate-900">{metric.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
