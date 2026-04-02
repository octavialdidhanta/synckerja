import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/utils/formatCurrency';
import { TrendingUp, Clock, CheckCircle, RotateCcw } from 'lucide-react';

export const ApprovalMetricsCards = () => {
  const { data: requests = [] } = usePurchaseRequests();

  const metrics = {
    total: {
      count: requests.length,
      amount: requests.reduce((sum, req) => sum + (req.amount_idr || 0), 0),
      icon: TrendingUp,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      accentColor: 'bg-brand-blue/50',
      label: 'Total Requests'
    },
    pending: {
      count: requests.filter(req => req.status === 'pending_approval' || req.status === 'submitted').length,
      amount: requests
        .filter(req => req.status === 'pending_approval' || req.status === 'submitted')
        .reduce((sum, req) => sum + (req.amount_idr || 0), 0),
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      accentColor: 'bg-amber-500',
      label: 'Pending Review'
    },
    approved: {
      count: requests.filter(req => req.status === 'approved').length,
      amount: requests
        .filter(req => req.status === 'approved')
        .reduce((sum, req) => sum + (req.amount_idr || 0), 0),
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      accentColor: 'bg-green-500',
      label: 'Approved'
    },
    recurring: {
      count: requests.filter(req => req.is_recurring).length,
      amount: requests
        .filter(req => req.is_recurring)
        .reduce((sum, req) => sum + (req.amount_idr || 0), 0),
      icon: RotateCcw,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      accentColor: 'bg-purple-500',
      label: 'Recurring'
    }
  };

  const cards = ['total', 'pending', 'approved', 'recurring'] as const;

  return (
    <>
      {cards.map((key) => {
        const metric = metrics[key];
        const Icon = metric.icon;
        
        return (
          <div key={key} className="bg-white rounded-md border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-500 mb-1">{metric.label}</div>
                <div className="text-lg font-bold text-gray-900">{metric.count}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatToRupiah(metric.amount)}
                </div>
              </div>
              <div className={`p-2 rounded-md ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
