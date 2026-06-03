interface IncomeTransactionSidebarFooterProps {
  totalTransactions: number;
  totalAmount: number;
  selectedType?: string;
}

export const IncomeTransactionSidebarFooter = ({ 
  totalTransactions, 
  totalAmount,
  selectedType
}: IncomeTransactionSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 border-t border-border bg-card px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Transactions: {totalTransactions}</span>
        <span className="text-xs text-muted-foreground/80">Total: {totalTransactions}</span>
      </div>
    </div>
  );
};

