import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { changeDue } from '../checkout/lib/cashChange';
import {
  buildStoreReceiptText,
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

function ReceiptRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-900 ${strong ? 'font-semibold tabular-nums' : 'tabular-nums'}`}>{value}</span>
    </div>
  );
}

export function CustomerVisitReceiptPanel({ visit, justPaid, onClose, onNextCheckIn, onOrderAgain }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organization } = useCentralizedUserData();
  const storeName = organization?.company_name?.trim() || t('customerVisits.receipt.storeFallback', 'Store');
  const lead = customerVisitLead(visit);
  const sale = customerVisitSale(visit);
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
  const totalLabel = amount != null ? formatToRupiah(amount) : '—';

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    const text = buildStoreReceiptText({
      storeName,
      receiptNumber,
      datetime,
      clientName: lead?.client || '—',
      ticketId: lead?.ticket_id || visit.lookup_raw,
      payMethod,
      paymentReference,
      tableNumber,
      cashReceived: showCash ? formatToRupiah(cashTendered) : null,
      change: change != null ? formatToRupiah(change) : null,
      items: items.map((item) => {
        const name = item.sub_service_name
          ? `${item.service_name} · ${item.sub_service_name}`
          : item.service_name;
        return {
          name,
          quantity: item.quantity,
          unitPrice: formatToRupiah(item.unit_price),
          lineTotal: formatToRupiah(item.total_price),
        };
      }),
      total: totalLabel,
    });
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
        className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{storeName}</p>
          {tableNumber ? (
            <p className="mt-1 text-2xl font-bold tracking-wide text-gray-900">
              {t('customerVisits.receipt.table', 'Table')} {tableNumber}
            </p>
          ) : null}
          {receiptNumber ? (
            <p className="mt-0.5 text-xs tabular-nums text-gray-600">{receiptNumber}</p>
          ) : null}
          {datetime ? (
            <p
              className="mt-0.5 text-xs text-gray-500"
              aria-label={t('customerVisits.receipt.dateTime', 'Date & time')}
            >
              {datetime}
            </p>
          ) : null}
        </div>

        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-900">{lead?.client || '—'}</p>
          <p className="mt-0.5 text-xs text-gray-500">{lead?.ticket_id || visit.lookup_raw}</p>
        </div>

        <div className="mt-4 space-y-1">
          <ReceiptRow label={t('customerVisits.table.pay', 'Pay')} value={payMethod} />
          {paymentReference ? (
            <ReceiptRow
              label={t('customerVisits.checkout.paymentReference', 'Payment reference')}
              value={paymentReference}
            />
          ) : null}
          {showCash ? (
            <ReceiptRow
              label={t('customerVisits.checkout.tendered', 'Cash received')}
              value={formatToRupiah(cashTendered)}
            />
          ) : null}
          {change != null ? (
            <ReceiptRow label={t('customerVisits.checkout.change', 'Change')} value={formatToRupiah(change)} />
          ) : null}
          <ReceiptRow label={t('customerVisits.checkout.total', 'Total')} value={totalLabel} strong />
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('customerVisits.receipt.items', 'Items')}
          </p>
          {receipt.isLoading ? (
            <p className="mt-2 text-sm text-gray-500">
              {t('customerVisits.receipt.loading', 'Loading receipt…')}
            </p>
          ) : receipt.isError ? (
            <p className="mt-2 text-sm text-gray-600">
              {t('customerVisits.receipt.error', 'Could not load receipt items.')}
            </p>
          ) : items.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              {t('customerVisits.receipt.empty', 'No line items on this receipt.')}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {items.map((item) => {
                const name = item.sub_service_name
                  ? `${item.service_name} · ${item.sub_service_name}`
                  : item.service_name;
                return (
                  <li key={item.id} className="rounded-md border border-gray-200 p-2">
                    <p className="truncate text-sm font-medium text-gray-900">{name}</p>
                    <div className="mt-1 flex justify-between text-xs text-gray-500">
                      <span>
                        {item.quantity} × {formatToRupiah(item.unit_price)}
                      </span>
                      <span className="tabular-nums text-gray-700">{formatToRupiah(item.total_price)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
