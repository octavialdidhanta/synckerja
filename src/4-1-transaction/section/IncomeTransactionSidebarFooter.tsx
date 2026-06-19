import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface IncomeTransactionSidebarFooterProps {
  filteredTransactions: number;
  totalTransactions: number;
}

export const IncomeTransactionSidebarFooter = ({
  filteredTransactions,
  totalTransactions,
}: IncomeTransactionSidebarFooterProps) => {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('incomes.transaction.footer.transactionCount', 'Transactions: {{count}}', {
            count: filteredTransactions,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('incomes.transaction.footer.total', 'Total: {{count}}', {
            count: totalTransactions,
          })}
        </span>
      </div>
    </div>
  );
};
