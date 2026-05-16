import { IncomeTransactionOverview } from './IncomeTransactionOverview';
import { IncomeTransactionSidebarFooter } from './IncomeTransactionSidebarFooter';

type Props = {
  transactions: Parameters<typeof IncomeTransactionOverview>[0]['transactions'];
  totalAmount: number;
  selectedType: string;
};

export function IncomeTransactionSidebarColumn({
  transactions,
  totalAmount,
  selectedType,
}: Props) {
  const count = transactions?.length ?? 0;
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
        <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground">Income Overview</h3>
              <p className="mt-1 text-xs text-muted-foreground">Summary of income transactions</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full min-h-0 overflow-hidden p-4">
            <IncomeTransactionOverview transactions={transactions} />
          </div>
        </div>

        <IncomeTransactionSidebarFooter
          totalTransactions={count}
          totalAmount={totalAmount}
          selectedType={selectedType}
        />
      </div>
    </div>
  );
}
