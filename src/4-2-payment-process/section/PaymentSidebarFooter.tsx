import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface PaymentSidebarFooterProps {
  totalRequests: number;
  totalAmount: number;
}

export const PaymentSidebarFooter = ({ totalRequests, totalAmount }: PaymentSidebarFooterProps) => {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('expenses.paymentProcess.sidebarFooter.requests', 'Requests: {{count}}', {
            count: totalRequests,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('expenses.paymentProcess.sidebarFooter.total', 'Total: {{amount}}', {
            amount: formatToRupiah(totalAmount),
          })}
        </span>
      </div>
    </div>
  );
};
