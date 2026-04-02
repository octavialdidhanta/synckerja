import { formatToRupiah } from '@/utils/formatCurrency';

interface ApprovalTableFooterProps {
  totalRequests: number;
  filteredRequests: number;
  totalAmount: number;
  selectedStatus?: string;
}

export const ApprovalTableFooter = ({ 
  totalRequests, 
  filteredRequests = totalRequests,
  totalAmount,
  selectedStatus 
}: ApprovalTableFooterProps) => {
  const statusText = selectedStatus && selectedStatus !== 'all' 
    ? ` in ${selectedStatus}` 
    : '';
    
  return (
    <div className="flex-shrink-0 px-4 py-0.5 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Showing {filteredRequests} of {totalRequests} requests{statusText}</span>
        <div className="flex flex-col items-end gap-0">
          <span className="text-xs text-gray-400 leading-tight">Total: {formatToRupiah(totalAmount)}</span>
          <span className="text-xs text-gray-400 leading-tight">{totalRequests} requests</span>
        </div>
      </div>
    </div>
  );
};
