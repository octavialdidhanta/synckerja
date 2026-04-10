import { Expense } from '@/shared/hooks/finance/useExpenses';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { openSupabaseSignedFile } from '@/shared/utils/openSupabaseSignedFile';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';

async function openReceiptOrInvoice(
  filePath: string,
  t: (key: string, defaultValue?: string) => string
) {
  const tryBuckets = ['purchase-documents', 'expense-receipts'] as const;
  for (const bucket of tryBuckets) {
    try {
      const result = await openSupabaseSignedFile({ bucket, filePath, expiresInSeconds: 3600 });
      if (result.ok) return;
    } catch {
      /* try next bucket */
    }
  }
  toast.error(t('reminderBills.openFileFailed', 'Failed to open file. Please try again.'));
}

interface ReminderBillDetailDialogProps {
  bill: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReminderBillDetailDialog({ bill, open, onOpenChange }: ReminderBillDetailDialogProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();

  const onViewFile = (path: string | null | undefined) => {
    if (!path) {
      toast.error(t('reminderBills.filePathMissing', 'File path not found'));
      return;
    }
    void openReceiptOrInvoice(path, t);
  };

  const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isMobile
            ? "modal-above-safe-area fixed left-0 right-0 top-0 max-h-none w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none p-0"
            : "w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto min-w-0"
        }
        fullscreenAnimation={isMobile}
      >
        <DialogHeader>
          <DialogTitle>{t('reminderBills.billDetailsTitle', 'Bill details')}</DialogTitle>
          <DialogDescription>
            {t('reminderBills.billDetailsDescription', 'Summary of this recurring bill.')}
          </DialogDescription>
        </DialogHeader>
        {bill && (
          <div className="space-y-4">
            {bill.bill_source === 'purchase_request' && (
              <Badge variant="secondary" className="text-xs">
                {t('reminderBills.fromPurchaseRequest', 'From purchase request')}
              </Badge>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('expenses.expenseName', 'Expense name')}
                </label>
                <p className="text-sm font-semibold mt-1">{bill.expense_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('expenses.amount', 'Amount')}</label>
                <p className="text-sm font-semibold mt-1">{formatCurrency(bill.amount)}</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('expenses.tableTransactionId', 'Transaction ID')}
                </label>
                <p className="text-sm font-mono mt-1 break-all">
                  {bill.transaction_reference?.trim() || '—'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('expenses.type', 'Type')}</label>
                <p className="text-sm mt-1">{bill.expense_type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('expenses.category', 'Category')}</label>
                <p className="text-sm mt-1">{bill.category}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('expenses.department', 'Department')}</label>
                <p className="text-sm mt-1">{bill.department || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('expenses.status', 'Status')}</label>
                <div className="mt-1">
                  <Badge variant={bill.is_recurring ? 'default' : 'secondary'}>
                    {bill.is_recurring
                      ? t('expenses.recurring', 'Recurring')
                      : t('expenses.oneTime', 'One-time')}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('expenses.paymentDate', 'Payment date')}
                </label>
                <p className="text-sm mt-1">{format(new Date(bill.create_date), 'dd MMM yyyy')}</p>
              </div>
              {bill.next_payment_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('expenses.nextPayment', 'Next payment')}
                  </label>
                  <p className="text-sm mt-1">{format(new Date(bill.next_payment_date), 'dd MMM yyyy')}</p>
                </div>
              )}
              {bill.is_recurring && bill.recurring_frequency && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('incomes.recurringFrequency', 'Recurring frequency')}
                  </label>
                  <p className="text-sm mt-1 capitalize">{bill.recurring_frequency}</p>
                </div>
              )}
              {bill.first_payment_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('reminderBills.firstPaymentDate', 'First payment date')}
                  </label>
                  <p className="text-sm mt-1">{format(new Date(bill.first_payment_date), 'dd MMM yyyy')}</p>
                </div>
              )}
            </div>
            {bill.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('expenses.description', 'Description')}
                </label>
                <p className="text-sm mt-1">{bill.description}</p>
              </div>
            )}
            {bill.receipt_url && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {bill.bill_source === 'purchase_request'
                    ? t('expenses.viewInvoice', 'View invoice')
                    : t('expenses.receipt', 'Receipt')}
                </label>
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => onViewFile(bill.receipt_url)}>
                    <Receipt className="h-4 w-4 mr-2" />
                    {bill.bill_source === 'purchase_request'
                      ? t('expenses.viewInvoice', 'View invoice')
                      : t('expenses.viewReceipt', 'View receipt')}
                  </Button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('reminderBills.createdAt', 'Created at')}
                </label>
                <p className="text-sm mt-1">{format(new Date(bill.created_at), 'dd MMM yyyy HH:mm')}</p>
              </div>
              {bill.updated_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('reminderBills.updatedAt', 'Updated at')}
                  </label>
                  <p className="text-sm mt-1">{format(new Date(bill.updated_at), 'dd MMM yyyy HH:mm')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ReminderBillDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ReminderBillDeleteDialog({ open, onOpenChange, onConfirm }: ReminderBillDeleteDialogProps) {
  const { t } = useAppTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('reminderBills.removeFromReminderTitle', 'Remove from reminders')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'reminderBills.removeFromReminderDescription',
              'This removes the bill from reminder bills only. Recorded expenses, bank balances, debt limits, and income links are not changed.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('expenses.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t('reminderBills.removeFromReminderConfirm', 'Remove')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
