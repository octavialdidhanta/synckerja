import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface IncomeTransactionTableFooterProps {
  totalTransactions: number;
  filteredTransactions: number;
  selectedType?: string;
}

export const IncomeTransactionTableFooter = ({
  totalTransactions,
  filteredTransactions = totalTransactions,
  selectedType,
}: IncomeTransactionTableFooterProps) => {
  const { t } = useAppTranslation();
  const typeText =
    selectedType && selectedType !== 'all'
      ? t('incomes.transaction.tableFooter.inType', ' in {{type}}', { type: selectedType })
      : '';

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t(
            'incomes.transaction.tableFooter.showing',
            'Showing {{filtered}} of {{total}} transactions{{typeSuffix}}',
            {
              filtered: filteredTransactions,
              total: totalTransactions,
              typeSuffix: typeText,
            },
          )}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('incomes.transaction.tableFooter.total', 'Total: {{total}} transactions', {
            total: totalTransactions,
          })}
        </span>
      </div>
    </div>
  );
};
