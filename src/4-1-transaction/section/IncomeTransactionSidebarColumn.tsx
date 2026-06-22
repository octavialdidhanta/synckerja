import { IncomeTransactionOverview } from './IncomeTransactionOverview';
import { IncomeTransactionSidebarFooter } from './IncomeTransactionSidebarFooter';

type Props = {
  transactions: Parameters<typeof IncomeTransactionOverview>[0]['transactions'];
  filteredCount: number;
  totalTransactions: number;
};

export function IncomeTransactionSidebarColumn({
  transactions,
  filteredCount,
  totalTransactions,
}: Props) {
  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Income Overview</h3>
            <p className="mt-1 text-xs text-muted-foreground">Summary of income transactions</p>
          </div>
        </div>
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="p-4">
          <IncomeTransactionOverview transactions={transactions} />
        </div>
      </div>

      <IncomeTransactionSidebarFooter
        filteredTransactions={filteredCount}
        totalTransactions={totalTransactions}
      />
    </div>
  );
}
