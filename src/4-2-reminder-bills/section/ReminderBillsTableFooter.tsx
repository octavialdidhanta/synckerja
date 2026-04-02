import { formatToRupiah } from '@/shared/utils/formatCurrency';

interface ReminderBillsTableFooterProps {
  totalBills: number;
  filteredBills: number;
  totalAmount: number;
  selectedStatus?: string;
}

export const ReminderBillsTableFooter = ({ 
  totalBills, 
  filteredBills = totalBills,
  totalAmount,
  selectedStatus 
}: ReminderBillsTableFooterProps) => {
  const statusText = selectedStatus && selectedStatus !== 'all' 
    ? ` in ${selectedStatus}` 
    : '';
    
  return (
    <div className="flex-shrink-0 px-4 py-0.5 border-t border-border bg-muted/30">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {filteredBills} of {totalBills} bills{statusText}</span>
        <div className="flex flex-col items-end gap-0">
          <span className="text-xs text-muted-foreground/70 leading-tight">Total: {formatToRupiah(totalAmount)}</span>
          <span className="text-xs text-muted-foreground/70 leading-tight">{totalBills} bills</span>
        </div>
      </div>
    </div>
  );
};
