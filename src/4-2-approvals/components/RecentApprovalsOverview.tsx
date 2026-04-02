
import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export const RecentApprovalsOverview = () => {
  const { data: requests = [] } = usePurchaseRequests();

  // Get recent requests (last 10)
  const recentRequests = requests
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-3.5 w-3.5 text-red-600" />;
      case 'pending_approval':
      case 'submitted':
        return <Clock className="h-3.5 w-3.5 text-amber-600" />;
      default:
        return <AlertTriangle className="h-3.5 w-3.5 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending_approval':
      case 'submitted':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'pending_approval':
      case 'submitted':
        return 'Pending';
      default:
        return 'Draft';
    }
  };

  return (
    <div className="space-y-3">
      {/* Overdue Approvals */}
      <div className="bg-red-50/50 border border-red-200/60 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 rounded bg-red-100">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          </div>
          <h4 className="text-xs font-semibold text-red-800">Overdue Approvals</h4>
        </div>
        <p className="text-2xl font-bold text-red-900 mb-1">
          {requests.filter(req => {
            const daysSinceSubmit = Math.floor((new Date().getTime() - new Date(req.created_at).getTime()) / (1000 * 60 * 60 * 24));
            return (req.status === 'pending_approval' || req.status === 'submitted') && daysSinceSubmit > 3;
          }).length}
        </p>
        <p className="text-xs text-red-600">Pending over 3 days</p>
      </div>

      {/* Due This Month */}
      <div className="bg-blue-50/50 border border-blue-200/60 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 rounded bg-blue-100">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <h4 className="text-xs font-semibold text-blue-800">Due This Month</h4>
        </div>
        <p className="text-2xl font-bold text-blue-900 mb-1">
          {requests.filter(req => {
            const requestDate = new Date(req.created_at);
            const currentDate = new Date();
            return requestDate.getMonth() === currentDate.getMonth() && 
                   requestDate.getFullYear() === currentDate.getFullYear() &&
                   (req.status === 'pending_approval' || req.status === 'submitted');
          }).length}
        </p>
        <p className="text-xs text-blue-600">
          {formatToRupiah(requests
            .filter(req => {
              const requestDate = new Date(req.created_at);
              const currentDate = new Date();
              return requestDate.getMonth() === currentDate.getMonth() && 
                     requestDate.getFullYear() === currentDate.getFullYear() &&
                     (req.status === 'pending_approval' || req.status === 'submitted');
            })
            .reduce((sum, req) => sum + (req.amount_idr || 0), 0)
          )}
        </p>
      </div>

      {/* Upcoming Approvals */}
      <div>
        <h4 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">Upcoming Approvals</h4>
        <div className="space-y-2">
          {recentRequests.slice(0, 5).map((request) => (
            <div key={request.id} className="flex items-start gap-3 p-2 bg-slate-50/50 rounded-md hover:bg-slate-100/50 transition-colors">
              <div className="p-1 rounded bg-white">
                {getStatusIcon(request.status)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">
                  {request.request_title}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {request.requester_name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs px-1.5 py-0.5 ${getStatusColor(request.status)}`}>
                    {getStatusText(request.status)}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {format(new Date(request.created_at), 'MMM dd')}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-900">
                  {formatToRupiah(request.amount_idr)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
