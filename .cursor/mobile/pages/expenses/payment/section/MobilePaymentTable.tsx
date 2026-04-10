import { useState } from "react";
import { PurchaseRequest } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { formatToRupiah } from "@/utils/formatCurrency";
import { Badge } from "@/features/ui/badge";
import { CreditCard, User, Building, Calendar } from "lucide-react";
import { format } from "date-fns";
import { MobilePaymentRequestDetailsModal } from "../modal/MobilePaymentRequestDetailsModal";

interface MobilePaymentTableProps {
  requests: PurchaseRequest[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function MobilePaymentTable({ requests, isLoading = false, onRefresh }: MobilePaymentTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);

  const paymentRequests = requests.filter((req) => req.status === "approved");

  const getStatusBadge = (request: PurchaseRequest) => {
    if (request.paid_at || request.payment_status === "paid") {
      return <Badge className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">Paid</Badge>;
    }
    if (request.payment_status === "processing") {
      return <Badge className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-0.5 rounded-full">Processing</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">Pending</Badge>;
  };

  const getTypeDisplay = (request: PurchaseRequest) => {
    if (request.request_type === "reimbursement") return request.reimbursement_type || "Reimbursement";
    return request.purchase_type || "Purchase";
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto seamless-scroll nested-scroll-touch-chain-xy touch-pan-x max-h-[50vh]">
        <table className="w-full min-w-[1400px] select-none">
          <thead className="border-b border-slate-400/50 sticky top-0 z-10 bg-slate-500">
            <tr>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Request</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Requester</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Department</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Amount</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Type</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Status</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Recurring</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Approval Date</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Paid Date</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Paid By</th>
              <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paymentRequests.length === 0 ? (
              <tr>
                <td colSpan={11} className="h-16 text-center">
                  <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-1">No payment requests found</p>
                  <p className="text-xs text-gray-400">Approved requests will appear here</p>
                </td>
              </tr>
            ) : (
              paymentRequests.map((request) => (
                <tr key={request.id} className="border-b hover:bg-muted/30 active:bg-gray-100">
                  <td className="px-3 py-2 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-md bg-blue-50 flex-shrink-0"><CreditCard className="h-3.5 w-3.5 text-blue-600" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">{request.request_title}</div>
                        <div className="text-xs text-gray-500 truncate mt-0.5">{request.description || "No description"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-gray-100"><User className="h-3 w-3 text-gray-600" /></div>
                      <span className="font-medium text-gray-700">{request.requester_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-gray-100"><Building className="h-3 w-3 text-gray-600" /></div>
                      <span>{request.department_name || "Not specified"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs"><div className="font-bold text-gray-900">{formatToRupiah(request.amount_idr)}</div></td>
                  <td className="px-3 py-2 text-xs"><Badge variant="outline" className="text-xs">{getTypeDisplay(request)}</Badge></td>
                  <td className="px-3 py-2 text-xs">{getStatusBadge(request)}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    <Badge variant={request.is_recurring ? "default" : "secondary"}>{request.is_recurring ? "Recurring" : "One-time"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {request.approved_at ? (
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-gray-100"><Calendar className="h-3 w-3 text-gray-600" /></div>
                        <span>{format(new Date(request.approved_at), "MMM dd, yyyy")}</span>
                      </div>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {request.paid_at ? (
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-gray-100"><Calendar className="h-3 w-3 text-gray-600" /></div>
                        <span>{format(new Date(request.paid_at), "MMM dd, yyyy")}</span>
                      </div>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{request.paid_by_name ? <span className="font-medium">{request.paid_by_name}</span> : <span className="text-gray-400">-</span>}</td>
                  <td className="px-3 py-2 text-xs">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="text-blue-600 hover:text-blue-800 active:text-blue-900 text-xs font-medium h-8 px-1.5 rounded-sm touch-manipulation"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MobilePaymentRequestDetailsModal
        request={selectedRequest}
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onRefresh={onRefresh}
      />
    </div>
  );
}
