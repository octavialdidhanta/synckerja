import { formatToRupiah } from '@/shared/utils/formatCurrency';

interface PaymentSidebarFooterProps {
  totalRequests: number;
  totalAmount: number;
  selectedStatus?: string;
}

export const PaymentSidebarFooter = ({ 
  totalRequests, 
  totalAmount,
  selectedStatus
}: PaymentSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-card">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Requests: {totalRequests}</span>
        <span className="text-xs text-muted-foreground/80">Total: {formatToRupiah(totalAmount)}</span>
      </div>
    </div>
  );
};
