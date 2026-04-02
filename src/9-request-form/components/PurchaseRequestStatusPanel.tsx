import React, { useState, useMemo, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { CheckCircle, XCircle, FileText, Clock, Calendar, Filter, Search } from 'lucide-react';
import { usePurchaseRequests, PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';

const PurchaseRequestStatusPanel = () => {
  const fieldIds = useId();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');

  const { data: purchaseRequests = [] } = usePurchaseRequests();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'submitted':
      case 'pending_approval':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'draft':
        return <FileText className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      submitted: 'bg-primary/10 text-primary border-primary/20',
      pending_approval: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
    };

    const displayText = {
      approved: 'Approved',
      rejected: 'Rejected',
      submitted: 'Submitted',
      pending_approval: 'Pending',
      draft: 'Draft',
      cancelled: 'Cancelled'
    };

    return (
      <Badge className={`${variants[status as keyof typeof variants]} text-xs px-2 py-1`}>
        {displayText[status as keyof typeof displayText] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Filter data based on search and filters
  const filteredRequests = useMemo(() => {
    if (!purchaseRequests) return [];

    return purchaseRequests.filter(req => {
      const matchesSearch = req.request_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (req.purchase_type || req.reimbursement_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           req.requester_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchesType = typeFilter === 'all' || req.purchase_type === typeFilter || req.reimbursement_type === typeFilter;
      const matchesRequestType = requestTypeFilter === 'all' || req.request_type === requestTypeFilter;
      
      // Simple date filtering - you can enhance this
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const requestDate = new Date(req.created_at);
        const now = new Date();
        
        switch (dateFilter) {
          case 'today':
            matchesDate = requestDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = requestDate >= weekAgo;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesDate = requestDate >= monthAgo;
            break;
          case 'quarter':
            const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            matchesDate = requestDate >= quarterAgo;
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesType && matchesRequestType && matchesDate;
    });
  }, [purchaseRequests, searchTerm, statusFilter, typeFilter, requestTypeFilter, dateFilter]);

  const approvedRequests = filteredRequests.filter(req => req.status === 'approved');
  const rejectedRequests = filteredRequests.filter(req => req.status === 'rejected');
  const draftRequests = filteredRequests.filter(req => req.status === 'draft');
  const pendingRequests = filteredRequests.filter(req => 
    req.status === 'submitted' || req.status === 'pending_approval'
  );

  const RequestItem = ({ request }: { request: PurchaseRequest }) => (
    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
      {getStatusIcon(request.status)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {request.request_title}
          </p>
          {getStatusBadge(request.status)}
        </div>
        <p className="text-xs text-gray-600 mb-1">
          {request.request_type === 'reimbursement' 
            ? `${request.reimbursement_type} (Reimbursement)`
            : request.purchase_type
          }
        </p>
        <p className="text-xs text-gray-500 mb-1">by {request.requester_name}</p>
        <p className="text-sm font-semibold text-primary">
          {formatCurrency(request.amount_idr)}
        </p>
        <p className="text-xs text-gray-500">
          {request.expense_date 
            ? `Expense: ${new Date(request.expense_date).toLocaleDateString('id-ID')}`
            : new Date(request.created_at).toLocaleDateString('id-ID')
          }
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Status</h2>
        
        {/* Search and Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              id={`${fieldIds}-search`}
              name="request_status_search"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>
          
          {/* Filters */}
          <div className="grid grid-cols-1 gap-2">
            <Select name="request_status_filter_request_type" value={requestTypeFilter} onValueChange={setRequestTypeFilter}>
              <SelectTrigger
                id={`${fieldIds}-filter-request-type`}
                name="request_status_filter_request_type"
                className="h-9 text-sm"
              >
                <SelectValue placeholder="Filter by request type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="reimbursement">Reimbursement</SelectItem>
              </SelectContent>
            </Select>

            <Select name="request_status_filter_status" value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                id={`${fieldIds}-filter-status`}
                name="request_status_filter_status"
                className="h-9 text-sm"
              >
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="pending_approval">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            
            <Select name="request_status_filter_purchase_type" value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                id={`${fieldIds}-filter-type`}
                name="request_status_filter_purchase_type"
                className="h-9 text-sm"
              >
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Physical Item">Physical Item</SelectItem>
                <SelectItem value="Google Ads Budget">Google Ads</SelectItem>
                <SelectItem value="Meta/Facebook Ads Budget">Facebook Ads</SelectItem>
                <SelectItem value="Software/Subscription">Software</SelectItem>
                <SelectItem value="Service">Service</SelectItem>
                <SelectItem value="Travel">Travel</SelectItem>
                <SelectItem value="Meals">Meals</SelectItem>
                <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            
            <Select name="request_status_filter_date" value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger
                id={`${fieldIds}-filter-date`}
                name="request_status_filter_date"
                className="h-9 text-sm"
              >
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || requestTypeFilter !== 'all' || dateFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
                setRequestTypeFilter('all');
                setDateFilter('all');
              }}
              className="h-8 text-xs"
            >
              <Filter className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-4 p-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-green-200">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-xs font-medium text-green-800">Approved</p>
                    <p className="text-lg font-bold text-green-900">{approvedRequests.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-red-200">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-xs font-medium text-red-800">Rejected</p>
                    <p className="text-lg font-bold text-red-900">{rejectedRequests.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  Pending Approval ({pendingRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <RequestItem key={request.id} request={request} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Approved */}
          {approvedRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Recently Approved ({approvedRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {approvedRequests.slice(0, 3).map((request) => (
                    <RequestItem key={request.id} request={request} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Draft Requests */}
          {draftRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-600" />
                  Saved Drafts ({draftRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {draftRequests.map((request) => (
                    <RequestItem key={request.id} request={request} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Rejected */}
          {rejectedRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Recently Rejected ({rejectedRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {rejectedRequests.slice(0, 2).map((request) => (
                    <RequestItem key={request.id} request={request} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Results */}
          {filteredRequests.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No requests found</h3>
              <p className="text-sm text-gray-500">
                {purchaseRequests.length === 0 
                  ? "No purchase requests have been created yet."
                  : "Try adjusting your search or filter criteria"
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequestStatusPanel;
