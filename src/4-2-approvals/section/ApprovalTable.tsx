import { useState } from 'react';
import type { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { CreditCard, User, Building, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ApprovalActionsDropdown } from '../components/ApprovalActionsDropdown';
import { PurchaseRequestDetailsModal } from '../components/PurchaseRequestDetailsModal';

interface ApprovalTableProps {
  requests: PurchaseRequest[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const ApprovalTable = ({ 
  requests, 
  isLoading = false,
  onRefresh 
}: ApprovalTableProps) => {
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="text-xs font-medium px-2 py-0.5 rounded-full">
            Rejected
          </Badge>
        );
      case 'pending_approval':
      case 'submitted':
        return (
          <Badge className="bg-brand-blue/10 text-brand-blue text-xs font-medium px-2 py-0.5 rounded-full">
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 rounded-full">
            Draft
          </Badge>
        );
    }
  };

  const getTypeDisplay = (request: PurchaseRequest) => {
    if (request.request_type === 'reimbursement') {
      return request.reimbursement_type || 'Reimbursement';
    }
    return request.purchase_type || 'Purchase';
  };

  const handleViewDetails = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-semibold text-gray-900">Approval Requests</h2>
      </div>

      {/* Horizontal scroll only; vertikal mengikuti scroll halaman (tanpa wrapper overflow-auto Table shadcn) */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[1300px] caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-sm">
              <TableRow className="border-b bg-gray-50">
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap w-[280px] max-w-[280px]">Request</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Requester</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Department</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Amount</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Type</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Status</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Recurring</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Request Date</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Approved Date</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium whitespace-nowrap">Approved By</TableHead>
                <TableHead className="h-8 px-3 text-xs font-medium w-16 whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-16 text-center">
                  <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-1">No approval requests found</p>
                  <p className="text-xs text-gray-400">Create your first approval request to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow key={request.id} className="hover:bg-gray-50">
                  <TableCell className="px-3 py-2 text-xs max-w-[280px] w-[280px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-start gap-2 min-w-0 cursor-default">
                          <div className="p-1.5 rounded-md bg-brand-blue/10 flex-shrink-0">
                            <CreditCard className="h-3.5 w-3.5 text-brand-blue" />
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="font-medium text-gray-900 truncate">
                              {request.request_title}
                            </div>
                            <div className="text-xs text-gray-500 truncate mt-0.5 line-clamp-2">
                              {request.description || 'No description'}
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm">
                        <div className="space-y-1">
                          <p className="font-medium">{request.request_title}</p>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                            {request.description || 'No description'}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-gray-100">
                        <User className="h-3 w-3 text-gray-600" />
                      </div>
                      <span className="font-medium text-gray-700">{request.requester_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-gray-100">
                        <Building className="h-3 w-3 text-gray-600" />
                      </div>
                      <span>{request.department_name || 'Not specified'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="font-bold text-gray-900">{formatToRupiah(request.amount_idr)}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <Badge variant="outline" className="text-xs">
                      {getTypeDisplay(request)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {getStatusBadge(request.status)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs whitespace-nowrap">
                    <Badge variant={request.is_recurring ? 'default' : 'secondary'}>
                      {request.is_recurring ? 'Recurring' : 'One-time'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-gray-100">
                        <Calendar className="h-3 w-3 text-gray-600" />
                      </div>
                      <span>{format(new Date(request.created_at || request.submitted_at || ''), 'MMM dd, yyyy')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-gray-600">
                    {request.approved_at ? (
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-gray-100">
                          <Calendar className="h-3 w-3 text-gray-600" />
                        </div>
                        <span>{format(new Date(request.approved_at), 'MMM dd, yyyy')}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-gray-600">
                    {request.approved_by_name ? (
                      <span className="font-medium">{request.approved_by_name}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <ApprovalActionsDropdown
                      requestId={request.id}
                      status={request.status || ''}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>

      {/* Request Details Modal */}
      <PurchaseRequestDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
      />
    </div>
  );
};
