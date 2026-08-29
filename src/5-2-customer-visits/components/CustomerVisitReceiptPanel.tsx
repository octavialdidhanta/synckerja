import { useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { computeCatalogCheckoutTotals } from '@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals';
import { PosReceiptDocument } from '@/8-2-6-receipt/components/PosReceiptDocument';
import { useResolvedPosReceipt } from '@/8-2-6-receipt/hooks/useResolvedPosReceipt';
import { buildPosReceiptText } from '@/8-2-6-receipt/lib/buildPosReceiptText';
import { mapStoreCheckoutReceiptTransaction } from '@/8-2-6-receipt/lib/mapStoreCheckoutReceipt';
import { useStoreCheckoutPricing } from '../checkout/hooks/useStoreCheckoutPricing';
import { changeDue } from '../checkout/lib/cashChange';
import {
  formatStoreReceiptDateTime,
  formatStoreReceiptNumber,
} from '../checkout/lib/formatStoreReceiptNumber';
import { useCustomerVisitReceipt } from '../hooks/useCustomerVisitReceipt';
import { customerVisitLead, type CustomerVisitRow } from '../lib/customerVisit.types';
import { customerVisitSale } from '../lib/customerVisitSale';

type Props = {
  visit: CustomerVisitRow;
  justPaid?: boolean;
  onClose: () => void;
  onNextCheckIn?: () => void;
  onOrderAgain?: () => void;
};

export function CustomerVisitReceiptPanel({ visit, justPaid, onClose, onNextCheckIn, onOrderAgain }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const lead = customerVisitLead(visit);
  const sale = customerVisitSale(visit);
  const outletId = sale?.pos_outlet_id ?? null;
  const salesTypeId = sale?.catalog_sales_type_id ?? null;
  const { branding, isLoading: brandingLoading } = useResolvedPosReceipt(outletId);
  const pricing = useStoreCheckoutPricing(outletId, salesTypeId);
  const amountRaw = Number(sale?.total_amount);
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null;
  const receipt = useCustomerVisitReceipt(visit.sales_activity_id);
  const activityId = sale?.id ?? visit.sales_activity_id;
  const receiptNumber = formatStoreReceiptNumber(activityId);
  const datetime = formatStoreReceiptDateTime({
    saleCreatedAt: sale?.created_at,
    visitCreatedAt: visit.created_at,
    visitDate: sale?.date || visit.visit_date,
  });
  const payMethod = sale?.payment_method
    ? t(`customerVisits.checkout.method.${sale.payment_method}`, sale.payment_method)
    : '—';
  const paymentReference = sale?.payment_reference?.trim() || null;
  const cashTenderedRaw = sale?.cash_tendered;
  const cashTendered = Number(cashTenderedRaw);
  const showCash =
    sale?.payment_method === 'cash' &&
    cashTenderedRaw != null &&
    Number.isFinite(cashTendered) &&
    cashTendered >= 0;
  const change = showCash && amount != null ? changeDue(amount, cashTendered) : null;
  const tableNumber = (sale?.table_number ?? visit.table_number)?.trim() || null;
  const items = receipt.data ?? [];

  const recomputedTotals = useMemo(() => {
    const subtotal = Number(sale?.checkout_subtotal);
    if (!Number.isFinite(subtotal) || subtotal <= 0) return null;
    return computeCatalogCheckoutTotals({
      subtotal,
      settings: pricing.settings,
      taxes: pricing.outletTaxes,
      gratuities: pricing.outletGratuities,
    });
  }, [pricing.settings, pricing.outletTaxes, pricing.outletGratuities, sale?.checkout_subtotal]);

  const transaction = mapStoreCheckoutReceiptTransaction({
    sale,
    items,
    receiptNumber,
    datetime,
    clientName: lead?.client || '—',
    ticketId: lead?.ticket_id || visit.lookup_raw,
    tableNumber,
    payMethod,
    paymentReference,
    cashTendered: showCash ? cashTendered : null,
    change,
    taxLines: recomputedTotals?.taxLines,
    gratuityLines: recomputedTotals?.gratuityLines,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    const text = buildPosReceiptText({ branding, transaction });
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t('customerVisits.receipt.copied', 'Receipt copied') });
    } catch {
      toast({
        title: t('customerVisits.receipt.copyFailed', 'Could not copy receipt.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 border-b px-4 py-1.5 print:hidden">
        <h3 className="text-sm font-semibold text-gray-900">
          {t('customerVisits.receipt.title', 'Store receipt')}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {t('customerVisits.receipt.subtitle', 'Read-only. Edit is not available here.')}
        </p>
      </div>
      <div
        id="store-receipt-print"
        className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 justify-center overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {receipt.isLoading || brandingLoading ? (
          <p className="text-sm text-gray-500">{t('customerVisits.receipt.loading', 'Loading receipt…')}</p>
        ) : receipt.isError ? (
          <p className="text-sm text-gray-600">
            {t('customerVisits.receipt.error', 'Could not load receipt items.')}
          </p>
        ) : (
          <PosReceiptDocument
            branding={branding}
            transaction={transaction}
            showClientBlock
            showLinks={Boolean(
              branding.social.websiteUrl ||
                branding.social.twitterUrl ||
                branding.social.facebookUrl ||
                branding.social.instagramUrl,
            )}
            showNote={Boolean(branding.display.notes)}
            className="print:shadow-none print:ring-0"
          />
        )}
      </div>
      <div className="flex-shrink-0 space-y-2 border-t bg-gray-50 px-4 py-3 print:hidden">
        {justPaid ? (
          <p className="text-xs text-gray-600">
            {t(
              'customerVisits.receipt.justPaid',
              'Payment recorded. Lead Magnet will count this transaction.',
            )}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant={justPaid ? 'outline' : 'default'} className="flex-1" onClick={handlePrint}>
            {t('customerVisits.receipt.print', 'Print')}
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => void handleCopy()}>
            {t('customerVisits.receipt.copy', 'Copy')}
          </Button>
        </div>
        {justPaid && onNextCheckIn ? (
          <Button type="button" className="w-full" onClick={onNextCheckIn}>
            {t('customerVisits.receipt.nextCheckIn', 'Next check-in')}
          </Button>
        ) : null}
        {onOrderAgain ? (
          <Button type="button" variant={justPaid ? 'outline' : 'default'} className="w-full" onClick={onOrderAgain}>
            {t('customerVisits.receipt.orderAgain', 'Order again')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="w-full" onClick={onClose}>
          {t('customerVisits.receipt.close', 'Close')}
        </Button>
      </div>
    </div>
  );
}
