import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { format } from 'date-fns';
import { IncomeTransactionWithRelations } from '@/4-1-dashboard/types';
import { FileDown, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

interface IncomeTransactionViewDialogProps {
  transaction: IncomeTransactionWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

export const IncomeTransactionViewDialog = ({
  transaction,
  open,
  onOpenChange,
  onEdit
}: IncomeTransactionViewDialogProps) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  if (!transaction) return null;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const handleDownloadReceipt = async () => {
    try {
      const path = transaction.receipt_file_path as string;
      if (path.startsWith('http')) {
        window.open(path, '_blank');
        return;
      }
      const { supabase } = await import('@/shared/lib/supabaseClient');
      const { data, error } = await supabase.storage
        .from('income-receipts')
        .download(path);
      if (error) {
        console.error('Error downloading receipt:', error);
        return;
      }
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = transaction.receipt_file_name || `receipt-${transaction.id.substring(0, 8)}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download receipt:', err);
    }
  };

  const title = t('incomes.transactionDetailsTitle', 'Income Transaction Details');

  const paymentMethodLabel = (() => {
    const raw = transaction.payment_method?.trim();
    if (!raw) return '-';
    const keyMap: Record<string, string> = {
      cash: t('incomes.paymentMethod.cash', 'Cash'),
      bank_transfer: t('incomes.paymentMethod.bankTransfer', 'Bank Transfer'),
      credit_card: t('incomes.paymentMethod.creditCard', 'Credit Card'),
      debit_card: t('incomes.paymentMethod.debitCard', 'Debit Card'),
      digital_wallet: t('incomes.paymentMethod.digitalWallet', 'Digital Wallet'),
    };
    return keyMap[raw] ?? raw;
  })();

  const bodyScrollClass = cn(
    'scrollbar-hide seamless-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    isMobile ? 'px-4 py-4' : 'px-6 py-4',
  );

  const labelClass = 'text-sm font-medium text-muted-foreground';
  const valueClass = 'text-sm text-foreground mt-1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none h-dvh min-h-0 rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden'
            : 'max-w-2xl max-h-[85vh] w-full flex flex-col p-0 gap-0 overflow-hidden sm:rounded-lg',
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b text-left',
            isMobile
              ? 'safe-area-top flex flex-row flex-nowrap items-stretch gap-0 space-y-0 bg-gradient-to-r from-blue-50 to-indigo-50 px-0 py-0 dark:from-blue-950/20 dark:to-indigo-950/20'
              : 'px-6 pt-6 pb-4',
          )}
        >
          {isMobile ? (
            <div className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2">
              <DialogTitle className="m-0 min-w-0 flex-1 truncate py-0 pr-1 text-base font-semibold leading-tight">
                {title}
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="inline-flex h-9 w-9 shrink-0 rounded-full p-0"
                onClick={() => onOpenChange(false)}
                aria-label={t('layout.sheetClose', 'Close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <DialogTitle className="pr-10 text-lg font-semibold leading-tight">
              {title}
            </DialogTitle>
          )}
        </DialogHeader>

        <div className={bodyScrollClass}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelClass}>{t('incomes.transactionDate', 'Transaction Date')}</div>
              <p className={valueClass}>
                {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <div className={labelClass}>{t('incomes.amount', 'Amount')}</div>
              <p className={cn(valueClass, 'font-semibold text-green-600')}>
                {formatToRupiah(transaction.amount)}
              </p>
            </div>
          </div>

          <div>
            <div className={labelClass}>{t('incomes.tableTransactionId', 'Transaction ID')}</div>
            <p className={cn(valueClass, 'font-mono break-all')}>
              {transaction.transaction_reference?.trim() || '—'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelClass}>{t('incomes.customerName', 'Customer Name')}</div>
              <p className={valueClass}>{transaction.customer_name || '-'}</p>
            </div>
            <div>
              <div className={labelClass}>{t('incomes.paymentMethodLabel', 'Payment Method')}</div>
              <p className={valueClass}>{paymentMethodLabel}</p>
            </div>
          </div>

          <div>
            <div className={labelClass}>{t('incomes.bankAccount', 'Bank Account')}</div>
            <p className={valueClass}>{transaction.bank_accounts?.name || '-'}</p>
            {(transaction.bank_accounts?.bank_name || transaction.bank_accounts?.account_number) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[transaction.bank_accounts.bank_name, transaction.bank_accounts.account_number].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelClass}>{t('common.service', 'Service')}</div>
              <p className={valueClass}>{transaction.services?.name || '-'}</p>
              {transaction.sub_services?.name && (
                <p className="text-xs text-muted-foreground mt-1">{transaction.sub_services.name}</p>
              )}
            </div>
            <div>
              <div className={labelClass}>{t('incomes.typeAndCategory', 'Type & Category')}</div>
              <p className={valueClass}>{transaction.income_types?.name || t('common.unknown', 'Unknown')}</p>
              {transaction.income_categories?.name && (
                <p className="text-xs text-muted-foreground mt-1">{transaction.income_categories.name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelClass}>{t('common.status', 'Status')}</div>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(transaction.status || '')} className="text-xs">
                  {transaction.status || '-'}
                </Badge>
              </div>
            </div>
            <div>
              <div className={labelClass}>{t('incomes.recurringTransaction', 'Recurring')}</div>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={
                    transaction.is_recurring
                      ? 'text-xs bg-brand-blue/10 text-brand-blue border-brand-blue/20'
                      : 'text-xs'
                  }
                >
                  {transaction.is_recurring
                    ? transaction.recurring_frequency
                      ? `${t('incomes.recurringBadge', 'Recurring')} • ${transaction.recurring_frequency}`
                      : t('incomes.recurringBadge', 'Recurring')
                    : t('incomes.oneTimeBadge', 'One-time')}
                </Badge>
              </div>
            </div>
          </div>

          {transaction.description && (
            <div>
              <div className={labelClass}>{t('common.description', 'Description')}</div>
              <p className={cn(valueClass, 'whitespace-pre-wrap')}>{transaction.description}</p>
            </div>
          )}

          {transaction.receipt_file_path && (
            <div>
              <div className={labelClass}>{t('incomes.receiptFile', 'Receipt')}</div>
              <div className="mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-sm"
                  onClick={handleDownloadReceipt}
                >
                  <FileDown className="h-3 w-3 mr-1" />
                  {transaction.receipt_file_name || t('incomes.downloadReceipt', 'Download Receipt')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {onEdit ? (
          <div
            className={cn(
              'pt-3 pb-3 flex-shrink-0 border-t bg-muted/30',
              isMobile ? 'px-4' : 'px-6',
            )}
          >
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t('common.close', 'Close')}
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-w-[120px] flex items-center justify-center gap-1.5"
                onClick={() => {
                  onEdit();
                  onOpenChange(false);
                }}
              >
                {t('incomes.editTransaction', 'Edit Transaction')}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
