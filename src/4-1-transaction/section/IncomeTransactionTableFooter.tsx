import { formatToRupiah } from '@/utils/formatCurrency';

interface IncomeTransactionTableFooterProps {
  totalTransactions: number;
  filteredTransactions: number;
  totalAmount: number;
  selectedType?: string;
}

export const IncomeTransactionTableFooter = ({ 
  totalTransactions, 
  filteredTransactions = totalTransactions,
  totalAmount,
  selectedType 
}: IncomeTransactionTableFooterProps) => {
  const typeText = selectedType && selectedType !== 'all' 
    ? ` in ${selectedType}` 
    : '';
    
  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {filteredTransactions} of {totalTransactions} transactions{typeText}</span>
        <div className="flex flex-col items-end gap-0">
          <span className="text-xs leading-tight text-muted-foreground/80">Total: {formatToRupiah(totalAmount)}</span>
          <span className="text-xs leading-tight text-muted-foreground/80">{totalTransactions} transactions</span>
        </div>
      </div>
    </div>
  );
};

