import { usePurchaseRequests, PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface ApprovalOverviewProps {
  requests?: PurchaseRequest[];
}

export const ApprovalOverview = ({ requests: providedRequests }: ApprovalOverviewProps) => {
  const { data: allRequests = [] } = usePurchaseRequests();

  const requests = providedRequests ?? allRequests;

  // Calculate metrics
  const totalAmount = requests.reduce((sum, req) => sum + (req.amount_idr || 0), 0);
  const pendingCount = requests.filter(req => req.status === 'pending_approval' || req.status === 'submitted').length;
  const approvedCount = requests.filter(req => req.status === 'approved').length;
  const rejectedCount = requests.filter(req => req.status === 'rejected').length;
  
  // Get this month requests
  const thisMonth = new Date();
  const thisMonthRequests = requests.filter(req => {
    const requestDate = new Date(req.created_at || '');
    return requestDate.getMonth() === thisMonth.getMonth() && 
           requestDate.getFullYear() === thisMonth.getFullYear();
  });
  const thisMonthTotal = thisMonthRequests.reduce((sum, req) => sum + (req.amount_idr || 0), 0);

  // Get recent requests (last 5)
  const recentRequests = requests
    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
    .slice(0, 5);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-3.5 w-3.5 text-brand-red" />;
      case 'pending_approval':
      case 'submitted':
        return <Clock className="h-3.5 w-3.5 text-amber-600" />;
      default:
        return <AlertTriangle className="h-3.5 w-3.5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-brand-red/10 text-brand-red';
      case 'pending_approval':
      case 'submitted':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-3 bg-brand-blue/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-blue" />
              <span className="text-xs font-medium text-brand-blue">Total Amount</span>
            </div>
          </div>
          <div className="text-lg font-bold text-brand-blue">{formatToRupiah(totalAmount)}</div>
          <div className="text-xs text-brand-blue mt-1">{requests.length} requests</div>
        </div>

        <div className="p-3 bg-amber-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-900">Pending</span>
            </div>
          </div>
          <div className="text-lg font-bold text-amber-900">{pendingCount}</div>
          <div className="text-xs text-amber-600 mt-1">Awaiting review</div>
        </div>

        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-900">Approved</span>
            </div>
          </div>
          <div className="text-lg font-bold text-green-900">{approvedCount}</div>
          <div className="text-xs text-green-600 mt-1">This period</div>
        </div>
      </div>

      {/* This Month */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-xs font-medium text-gray-700 mb-2">This Month</div>
        <div className="text-sm font-semibold text-gray-900">{formatToRupiah(thisMonthTotal)}</div>
        <div className="text-xs text-gray-500 mt-1">{thisMonthRequests.length} requests</div>
      </div>

      {/* Recent Requests */}
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Recent Requests</div>
        <div className="space-y-2">
          {recentRequests.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No recent requests</p>
          ) : (
            recentRequests.map((request) => (
              <div key={request.id} className="flex items-start gap-3 p-2 bg-white rounded-md border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="p-1 rounded bg-gray-50 flex-shrink-0">
                  {getStatusIcon(request.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {request.request_title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {request.requester_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-xs px-1.5 py-0.5 ${getStatusColor(request.status)}`}>
                      {getStatusText(request.status)}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {format(new Date(request.created_at || ''), 'MMM dd')}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-900">
                    {formatToRupiah(request.amount_idr)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
