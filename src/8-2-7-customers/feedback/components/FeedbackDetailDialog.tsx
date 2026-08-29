import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { changeDue } from '@/5-2-customer-visits/checkout/lib/cashChange';
import {
  formatStoreReceiptDateTime,
  formatStoreReceiptNumber,
} from '@/5-2-customer-visits/checkout/lib/formatStoreReceiptNumber';
import { useStoreCheckoutPricing } from '@/5-2-customer-visits/checkout/hooks/useStoreCheckoutPricing';
import { computeCatalogCheckoutTotals } from '@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals';
import { PosReceiptDocument } from '@/8-2-6-receipt/components/PosReceiptDocument';
import { useResolvedPosReceipt } from '@/8-2-6-receipt/hooks/useResolvedPosReceipt';
import { mapStoreCheckoutReceiptTransaction } from '@/8-2-6-receipt/lib/mapStoreCheckoutReceipt';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { usePosReceiptFeedbackDetail } from '../hooks/usePosReceiptFeedbackDetail';
import { useReplyPosReceiptFeedback } from '../hooks/useReplyPosReceiptFeedback';
import type { PosReceiptFeedbackRow } from '../types';

type Props = {
  row: PosReceiptFeedbackRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatMessageTime(value: string): string {
  try {
    return format(parseISO(value), 'dd MMM yyyy HH:mm');
  } catch {
    return value;
  }
}

export function FeedbackDetailDialog({ row, open, onOpenChange }: Props) {
  const { t } = useAppTranslation();
  const [replyDraft, setReplyDraft] = useState('');
  const detailQuery = usePosReceiptFeedbackDetail(row?.salesActivityId ?? null);
  const replyMutation = useReplyPosReceiptFeedback();
  const outletId = detailQuery.data?.posOutletId ?? row?.posOutletId ?? null;
  const { branding, isLoading: brandingLoading } = useResolvedPosReceipt(outletId);
  const pricing = useStoreCheckoutPricing(outletId, detailQuery.data?.catalogSalesTypeId ?? null);

  useEffect(() => {
    setReplyDraft(row?.replyText ?? '');
  }, [row?.id, row?.replyText]);

  const transaction = useMemo(() => {
    const detail = detailQuery.data;
    if (!detail) return null;
    const receiptNumber = formatStoreReceiptNumber(detail.salesActivityId);
    const datetime = formatStoreReceiptDateTime({
      saleCreatedAt: detail.createdAt,
      visitCreatedAt: null,
      visitDate: detail.date,
    });
    const amount = detail.totalAmount;
    const cashTendered = detail.cashTendered;
    const showCash =
      detail.paymentMethod === 'cash' &&
      cashTendered != null &&
      Number.isFinite(cashTendered) &&
      cashTendered >= 0;
    const change = showCash ? changeDue(amount, cashTendered) : null;

    const subtotal = Number(detail.checkoutSubtotal);
    const recomputedTotals =
      Number.isFinite(subtotal) && subtotal > 0
        ? computeCatalogCheckoutTotals({
            subtotal,
            settings: pricing.settings,
            taxes: pricing.outletTaxes,
            gratuities: pricing.outletGratuities,
          })
        : null;

    return mapStoreCheckoutReceiptTransaction({
      sale: {
        id: detail.salesActivityId,
        total_amount: detail.totalAmount,
        checkout_subtotal: detail.checkoutSubtotal,
        checkout_tax_amount: detail.checkoutTaxAmount,
        checkout_gratuity_amount: detail.checkoutGratuityAmount,
        payment_method: detail.paymentMethod,
        payment_reference: detail.paymentReference,
        cash_tendered: detail.cashTendered,
        table_number: detail.tableNumber,
        created_at: detail.createdAt,
        date: detail.date,
        pos_outlet_id: detail.posOutletId,
        catalog_sales_type_id: detail.catalogSalesTypeId,
      },
      items: detail.items,
      receiptNumber,
      datetime,
      clientName: detail.clientName,
      ticketId: null,
      tableNumber: detail.tableNumber,
      payMethod: detail.paymentMethod ?? '—',
      paymentReference: detail.paymentReference,
      cashTendered: showCash ? cashTendered : null,
      change,
      taxLines: recomputedTotals?.taxLines,
      gratuityLines: recomputedTotals?.gratuityLines,
    });
  }, [detailQuery.data, pricing.outletGratuities, pricing.outletTaxes, pricing.settings]);

  const handleReply = async () => {
    if (!row) return;
    const text = replyDraft.trim();
    if (!text) return;
    await replyMutation.mutateAsync({ feedbackId: row.id, replyText: text });
    onOpenChange(false);
  };

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{row.customerName}</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">{row.customerName}</p>
                <p className="mb-1">{row.comment || t('customers.feedback.noComment', 'No comment')}</p>
                <p className="text-[11px] text-muted-foreground">{formatMessageTime(row.submittedAt)}</p>
              </div>

              {row.replyText ? (
                <div className="ml-auto max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm">
                  <p className="mb-1 text-xs font-medium text-primary">
                    {t('customers.feedback.businessReply', 'Business reply')}
                  </p>
                  <p className="mb-1">{row.replyText}</p>
                  {row.repliedAt ? (
                    <p className="text-[11px] text-muted-foreground">{formatMessageTime(row.repliedAt)}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-2 border-t p-4">
              <Textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder={t('customers.feedback.replyPlaceholder', 'Type your reply…')}
                rows={3}
              />
              {replyMutation.isError ? (
                <p className="text-xs text-destructive">
                  {t('customers.feedback.replyError', 'Could not send reply.')}
                </p>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-gray-50 p-4">
            {detailQuery.isLoading || brandingLoading ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : transaction ? (
              <PosReceiptDocument branding={branding} transaction={transaction} className="mx-auto max-w-sm" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('customers.feedback.receiptUnavailable', 'Receipt unavailable')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.done', 'Done')}
          </Button>
          <Button
            onClick={() => void handleReply()}
            disabled={!replyDraft.trim() || replyMutation.isPending}
          >
            {replyMutation.isPending
              ? t('customers.feedback.replying', 'Replying…')
              : t('customers.feedback.reply', 'Reply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
