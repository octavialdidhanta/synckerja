import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface ReminderBillsSidebarFooterProps {
  totalBills: number;
  totalAmount: number;
}

export const ReminderBillsSidebarFooter = ({ totalBills, totalAmount }: ReminderBillsSidebarFooterProps) => {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('expenses.reminderBills.sidebarFooter.bills', 'Bills: {{count}}', {
            count: totalBills,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('expenses.reminderBills.sidebarFooter.total', 'Total: {{amount}}', {
            amount: formatToRupiah(totalAmount),
          })}
        </span>
      </div>
    </div>
  );
};
