import { formatToRupiah } from '@/shared/utils/formatCurrency';

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
  selectedStatus,
}: ApprovalTableFooterProps) => {
  const statusText =
    selectedStatus && selectedStatus !== 'all' ? ` in ${selectedStatus}` : '';

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-0.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {filteredRequests} of {totalRequests} requests{statusText}
        </span>
        <span className="text-xs text-muted-foreground/70">
          Total: {formatToRupiah(totalAmount)}
        </span>
      </div>
    </div>
  );
};
