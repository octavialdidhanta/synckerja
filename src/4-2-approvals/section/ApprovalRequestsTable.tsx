
import { useState } from 'react';
import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { CreditCard, User, Building, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ActionsDropdown } from '../components/ActionsDropdown';
import { PurchaseRequestDetailsModal } from '../components/PurchaseRequestDetailsModal';

export const ApprovalRequestsTable = () => {
  const { data: requests = [] } = usePurchaseRequests();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
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
          <Badge className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
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

  const getTypeDisplay = (request: any) => {
    if (request.request_type === 'reimbursement') {
      return request.reimbursement_type || 'Reimbursement';
    }
    return request.purchase_type || 'Purchase';
  };

  const handleViewDetails = (request: any) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  const handleEdit = (request: any) => {
    console.log('Edit request:', request.id);
    // TODO: Implement edit functionality
  };

  const handleDelete = (request: any) => {
    console.log('Delete request:', request.id);
    // TODO: Implement delete functionality
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-800 tracking-tight mb-1">Approval Requests</h3>
        <p className="text-xs text-slate-500">Review and manage purchase and reimbursement requests</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/80 border-b border-slate-200/60">
            <tr>
              <th className="text-left p-3 text-xs font-medium uppercase tracking-wide text-slate-600">Request</th>
              <th className="text-left p-3 text-xs font-medium uppercase tracking-wide text-slate-600">Requester</th>
              <th className="text-left p-3 text-xs font-medium uppercase tracking-wide text-slate-600">Department</th>
              <th className="text-left p-3 text-xs font-medium uppercase tracking-wide text-slate-600">Amount</th>
              <th className="text-left p-3 text-xs font-medium uppercase tracking-wide text-slate-600">Type</th>
              <th className="text-left p-3 text-xs font-medium uppercase tracking-wide text-slate-600">Status</th>
              <th className="text-left p-3 text-xs font-medium uppercase tracking-wide text-slate-600">Date</th>
              <th className="text-left p-3 text-xs font-medium uppercase tracking-wide text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-sm text-slate-500 mb-2">No approval requests found</p>
                  <p className="text-xs text-slate-400">Create your first approval request to get started</p>
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-50/50 transition-all duration-200">
                  <td className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-blue-50">
                        <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium leading-tight text-slate-900 truncate max-w-48">
                          {request.request_title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-48">
                          {request.description || 'No description'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-slate-100">
                        <User className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                      <span className="text-xs font-medium text-slate-700">{request.requester_name}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-slate-100">
                        <Building className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                      <span className="text-xs text-slate-600">{request.department_name || 'Not specified'}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900">{formatToRupiah(request.amount_idr)}</p>
                      {request.is_recurring && (
                        <Badge variant="outline" className="text-xs">Recurring</Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs">
                      {getTypeDisplay(request)}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-slate-100">
                        <Calendar className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                      <span className="text-xs text-slate-600">
                        {format(new Date(request.created_at), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <ActionsDropdown
                      onViewDetails={() => handleViewDetails(request)}
                      onEdit={() => handleEdit(request)}
                      onDelete={() => handleDelete(request)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
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
