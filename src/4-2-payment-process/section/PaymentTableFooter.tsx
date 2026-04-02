import { formatToRupiah } from '@/shared/utils/formatCurrency';

interface PaymentTableFooterProps {
  totalRequests: number;
  filteredRequests: number;
  totalAmount: number;
  selectedStatus?: string;
}

export const PaymentTableFooter = ({ 
  totalRequests, 
  filteredRequests = totalRequests,
  totalAmount,
  selectedStatus 
}: PaymentTableFooterProps) => {
  const statusText = selectedStatus && selectedStatus !== 'all' 
    ? ` in ${selectedStatus}` 
    : '';
    
  return (
    <div className="flex-shrink-0 px-4 py-0.5 border-t border-border bg-card">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {filteredRequests} of {totalRequests} requests{statusText}</span>
        <div className="flex flex-col items-end gap-0">
          <span className="text-xs text-muted-foreground/80 leading-tight">Total: {formatToRupiah(totalAmount)}</span>
          <span className="text-xs text-muted-foreground/80 leading-tight">{totalRequests} requests</span>
        </div>
      </div>
    </div>
  );
};
