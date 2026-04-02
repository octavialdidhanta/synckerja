import { formatToRupiah } from '@/shared/utils/formatCurrency';

interface ReminderBillsSidebarFooterProps {
  totalBills: number;
  totalAmount: number;
  selectedStatus?: string;
}

export const ReminderBillsSidebarFooter = ({ 
  totalBills, 
  totalAmount,
  selectedStatus
}: ReminderBillsSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-muted/30">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Bills: {totalBills}</span>
        <span className="text-xs text-muted-foreground/70">Total: {formatToRupiah(totalAmount)}</span>
      </div>
    </div>
  );
};
