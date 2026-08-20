import { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { useOmnichannelIncomeBankAccount } from '@/shared/hooks/finance/useOmnichannelIncomeBankAccount';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { formatIdIntegerGrouping, stripToDigits } from '@/8-2-1-default-prices/utils/formatIdUnitPrice';
import type {
  CustomerVisitCartLine,
  CustomerVisitCartTotals,
  CustomerVisitCheckoutPaymentMethod,
} from '../lib/customerVisitCheckout.types';
import { catalogItemLabel, formatStoreCheckoutRp } from '../lib/catalogLabel';
import { changeDue, isTenderedEnough, parseTenderedAmount } from '../lib/cashChange';
import { findInsufficientStoreCheckoutStock } from '../lib/storeCheckoutStock';
import { lineTotal } from '../lib/sumCustomerVisitCart';
import type { CustomerVisitLeadCandidate } from '../../lib/matchCustomerVisitParty';

type Props = {
  lead: CustomerVisitLeadCandidate;
  lines: CustomerVisitCartLine[];
  totals: CustomerVisitCartTotals;
  paymentMethod: CustomerVisitCheckoutPaymentMethod;
  onPaymentMethodChange: (method: CustomerVisitCheckoutPaymentMethod) => void;
  onUpdateQty: (catalogId: string, quantity: number) => void;
  onUpdatePrice: (catalogId: string, unitPrice: number) => void;
  submitting?: boolean;
  alreadyPaid?: boolean;
  initialTableNumber?: string | null;
  onSkip: () => void;
  onPay: (args: {
    paymentMethod: CustomerVisitCheckoutPaymentMethod;
    lines: CustomerVisitCartLine[];
    paymentReference?: string | null;
    cashTendered?: number | null;
    tableNumber?: string | null;
  }) => void;
};

const PAY_METHODS: CustomerVisitCheckoutPaymentMethod[] = ['cash', 'bank_transfer', 'e_wallet'];

export function CustomerVisitCheckoutPanel({
  lead,
  lines,
  totals,
  paymentMethod,
  onPaymentMethodChange,
  onUpdateQty,
  onUpdatePrice,
  submitting,
  alreadyPaid,
  initialTableNumber,
  onSkip,
  onPay,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { omnichannelBank, loading: bankLoading } = useOmnichannelIncomeBankAccount();
  const [tendered, setTendered] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [tableNumber, setTableNumber] = useState(initialTableNumber?.trim() ?? '');
  const needsBank = paymentMethod === 'bank_transfer' || paymentMethod === 'e_wallet';
  const bankMissing = needsBank && !bankLoading && !omnichannelBank;
  const tenderedAmount = paymentMethod === 'cash' ? parseTenderedAmount(tendered) : null;
  const change = paymentMethod === 'cash' ? changeDue(totals.total, tenderedAmount) : null;
  const tenderOk = paymentMethod !== 'cash' || isTenderedEnough(totals.total, tenderedAmount);
  const canPay = totals.total > 0 && !submitting && !(needsBank && bankLoading) && !bankMissing && tenderOk;

  const handlePay = () => {
    const insufficient = findInsufficientStoreCheckoutStock(
      lines.map((line) => ({
        kind: line.kind,
        trackStock: line.trackStock,
        inventorySkuId: line.inventorySkuId,
        quantity: line.quantity,
        availableQty: line.availableQty,
        label: line.serviceName,
      })),
    );
    if (insufficient) {
      toast({
        title: t('customerVisits.toast.insufficientStockTitle', 'Not enough stock'),
        description: t('customerVisits.checkout.insufficientStock', '{{name}} only has {{qty}} left.', {
          name: insufficient.label || 'Item',
          qty: Number.isFinite(Number(insufficient.availableQty)) ? Number(insufficient.availableQty) : 0,
        }),
        variant: 'destructive',
      });
      return;
    }
    onPay({
      paymentMethod,
      lines,
      paymentReference: needsBank ? paymentReference.trim() || null : null,
      cashTendered: paymentMethod === 'cash' ? tenderedAmount : null,
      tableNumber: tableNumber.trim() || null,
    });
  };

  const formattedTendered = useMemo(() => tendered, [tendered]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 border-b px-4 py-1.5">
        <h3 className="text-sm font-semibold text-gray-900">
          {t('customerVisits.checkout.cart', 'Cart')}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {t('customerVisits.checkout.subtitle', 'Add items, then take payment.')}
        </p>
      </div>
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="rounded-md border border-brand-blue bg-brand-blue-soft/60 p-3">
          <p className="text-sm font-medium text-gray-900">{lead.client || '—'}</p>
          <p className="mt-0.5 text-xs text-gray-500">{lead.ticket_id}</p>
        </div>

        <div className="mt-4">
          {lines.length === 0 ? (
            <p className="text-sm text-gray-500">
              {t('customerVisits.checkout.emptyCart', 'Tap a catalog item to add it.')}
            </p>
          ) : (
            <>
            <ul className="space-y-2">
              {lines.map((line) => (
                <li key={line.catalogId} className="rounded-md border border-gray-200 p-2">
                  <p className="truncate text-sm font-medium text-gray-900">{catalogItemLabel(line)}</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={submitting}
                        onClick={() => onUpdateQty(line.catalogId, line.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={
                          submitting ||
                          (line.kind === 'product' &&
                            line.trackStock &&
                            line.availableQty != null &&
                            line.quantity >= line.availableQty)
                        }
                        onClick={() => onUpdateQty(line.catalogId, line.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-[10px] text-gray-500">
                        {t('customerVisits.checkout.unitPrice', 'Price (Rp)')}
                      </Label>
                      <Input
                        className="mt-0.5 h-8 w-28"
                        inputMode="numeric"
                        disabled={submitting}
                        value={line.unitPrice ? formatIdIntegerGrouping(String(line.unitPrice)) : ''}
                        onChange={(e) => {
                          const next = Number(stripToDigits(e.target.value));
                          onUpdatePrice(line.catalogId, Number.isFinite(next) ? next : 0);
                        }}
                      />
                    </div>
                    <span className="ml-auto text-xs tabular-nums text-gray-600">
                      {formatStoreCheckoutRp(lineTotal(line))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-gray-500">
              {t(
                'customerVisits.checkout.variantStockHint',
                'Tracked items with variants deduct the first variant until POS variant picking is available.',
              )}
            </p>
            </>
          )}
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('customerVisits.checkout.payment', 'Payment')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PAY_METHODS.map((method) => (
              <Button
                key={method}
                type="button"
                size="sm"
                variant={paymentMethod === method ? 'default' : 'outline'}
                className="h-8"
                disabled={submitting}
                onClick={() => onPaymentMethodChange(method)}
              >
                {t(`customerVisits.checkout.method.${method}`, method)}
              </Button>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            <Label htmlFor="table_number">{t('customerVisits.checkout.tableNumber', 'Table')}</Label>
            <Input
              id="table_number"
              className="h-9"
              disabled={submitting}
              maxLength={16}
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value.slice(0, 16))}
              placeholder={t('customerVisits.checkout.tablePlaceholder', 'Optional · 4, B2')}
            />
            <p className="text-[11px] text-gray-500">
              {t('customerVisits.checkout.tableHint', 'Leave empty for counter / takeaway.')}
            </p>
          </div>
          {paymentMethod === 'cash' ? (
            <div className="mt-3 space-y-1">
              <Label htmlFor="tendered">{t('customerVisits.checkout.tendered', 'Cash received')}</Label>
              <Input
                id="tendered"
                className="h-9"
                inputMode="numeric"
                disabled={submitting}
                value={formattedTendered}
                onChange={(e) => {
                  const digits = stripToDigits(e.target.value);
                  setTendered(digits ? formatIdIntegerGrouping(digits) : '');
                }}
                placeholder={t('customerVisits.checkout.tenderedPlaceholder', 'Optional')}
              />
              {change != null ? (
                <p className="text-sm text-gray-700">
                  {t('customerVisits.checkout.change', 'Change')}: {formatStoreCheckoutRp(change)}
                </p>
              ) : tenderedAmount != null && !tenderOk ? (
                <p className="text-xs text-red-600">
                  {t('customerVisits.checkout.tenderedShort', 'Cash received is less than the total.')}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 space-y-1">
              <Label htmlFor="pay_ref">{t('customerVisits.checkout.paymentReference', 'Payment reference')}</Label>
              <Input
                id="pay_ref"
                className="h-9"
                disabled={submitting}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={t(
                  'customerVisits.checkout.paymentReferencePlaceholder',
                  'Transfer / e-wallet ref (optional)',
                )}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 space-y-2 border-t bg-gray-50 px-4 py-3">
        {bankMissing ? (
          <p className="text-xs text-red-600">
            {t(
              'customerVisits.checkout.bankMissing',
              'Set an omnichannel income bank account before taking store payments.',
            )}
          </p>
        ) : null}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{t('customerVisits.checkout.total', 'Total')}</span>
          <span className="font-semibold tabular-nums text-gray-900">{formatStoreCheckoutRp(totals.total)}</span>
        </div>
        <Button type="button" className="w-full" disabled={!canPay} onClick={handlePay}>
          {t('customerVisits.checkout.pay', 'Take payment')}
        </Button>
        {alreadyPaid ? null : (
          <Button type="button" variant="outline" className="w-full" disabled={submitting} onClick={onSkip}>
            {t('customerVisits.checkout.skip', 'Finish without purchase')}
          </Button>
        )}
      </div>
    </div>
  );
}
