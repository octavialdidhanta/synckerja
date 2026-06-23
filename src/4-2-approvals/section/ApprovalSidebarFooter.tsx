import { formatToRupiah } from '@/shared/utils/formatCurrency';

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
    <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Requests: {totalRequests}</span>
        <span className="text-xs text-muted-foreground/70">Total: {formatToRupiah(totalAmount)}</span>
      </div>
    </div>
  );
};
