import { formatToRupiah } from '@/utils/formatCurrency';

interface ApprovalSidebarFooterProps {
  totalRequests: number;
  totalAmount: number;
  selectedStatus?: string;
}

export const ApprovalSidebarFooter = ({ 
  totalRequests, 
  totalAmount,
  selectedStatus
}: ApprovalSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Requests: {totalRequests}</span>
        <span className="text-xs text-gray-400">Total: {formatToRupiah(totalAmount)}</span>
      </div>
    </div>
  );
};
