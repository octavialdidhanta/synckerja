import type { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { Clock, CheckCircle, CreditCard, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface PaymentOverviewProps {
  /** Daftar yang dipakai untuk ringkasan (parent mengisi filtered vs full). */
  requests: PurchaseRequest[];
}

export const PaymentOverview = ({ requests }: PaymentOverviewProps) => {
  // Filter only approved requests
  const paymentRequests = requests.filter(req => req.status === 'approved');

  // Calculate metrics
  const totalAmount = paymentRequests.reduce((sum, req) => sum + (req.amount_idr || 0), 0);
  const pendingCount = paymentRequests.filter(req => !req.paid_at && req.payment_status !== 'processing').length;
  const paidCount = paymentRequests.filter(req => req.paid_at).length;
  const processingCount = paymentRequests.filter(req => req.payment_status === 'processing').length;
  
  // Get this month requests
  const thisMonth = new Date();
  const thisMonthRequests = paymentRequests.filter(req => {
    const requestDate = new Date(req.approved_at || req.created_at || '');
    return requestDate.getMonth() === thisMonth.getMonth() && 
           requestDate.getFullYear() === thisMonth.getFullYear();
  });
  const thisMonthTotal = thisMonthRequests.reduce((sum, req) => sum + (req.amount_idr || 0), 0);

  // Get recent requests (last 5)
  const recentRequests = paymentRequests
    .sort((a, b) => new Date(b.approved_at || b.created_at || '').getTime() - new Date(a.approved_at || a.created_at || '').getTime())
    .slice(0, 5);

  const getStatusIcon = (request: PurchaseRequest) => {
    if (request.paid_at) {
      return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
    }
    if (request.payment_status === 'processing') {
      return <CreditCard className="h-3.5 w-3.5 text-purple-600" />;
    }
    return <Clock className="h-3.5 w-3.5 text-amber-600" />;
  };

  const getStatusColor = (request: PurchaseRequest) => {
    if (request.paid_at) {
      return 'bg-green-100 text-green-800';
    }
    if (request.payment_status === 'processing') {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-amber-100 text-amber-800';
  };

  const getStatusText = (request: PurchaseRequest) => {
    if (request.paid_at) {
      return 'Paid';
    }
    if (request.payment_status === 'processing') {
      return 'Processing';
    }
    return 'Pending';
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-3 bg-brand-blue/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-blue" />
              <span className="text-xs font-medium text-brand-blue-deep">Total Amount</span>
            </div>
          </div>
          <div className="text-lg font-bold text-brand-blue-deep">{formatToRupiah(totalAmount)}</div>
          <div className="text-xs text-brand-blue mt-1">{paymentRequests.length} requests</div>
        </div>

        <div className="p-3 bg-amber-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-900">Pending</span>
            </div>
          </div>
          <div className="text-lg font-bold text-amber-900">{pendingCount}</div>
          <div className="text-xs text-amber-600 mt-1">Awaiting payment</div>
        </div>

        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-900">Paid</span>
            </div>
          </div>
          <div className="text-lg font-bold text-green-900">{paidCount}</div>
          <div className="text-xs text-green-600 mt-1">This period</div>
        </div>
      </div>

      {/* This Month */}
      <div className="p-3 bg-card rounded-lg border border-border">
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
              <div key={request.id} className="flex items-start gap-3 p-2 bg-card rounded-md border border-border hover:bg-muted/40 transition-colors">
                <div className="p-1 rounded bg-muted/40 flex-shrink-0">
                  {getStatusIcon(request)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {request.request_title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {request.requester_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-xs px-1.5 py-0.5 ${getStatusColor(request)}`}>
                      {getStatusText(request)}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {format(new Date(request.approved_at || request.created_at || ''), 'MMM dd')}
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
