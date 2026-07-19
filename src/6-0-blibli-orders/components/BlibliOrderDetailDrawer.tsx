import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { useTranslation } from 'react-i18next';
import type { BlibliOrderPackageGroup } from '@/blibli-orders/hooks/useBlibliOrderPackagesQuery';
import {
  formatBlibliEpoch,
  formatBlibliOrderMoney,
} from '@/blibli-orders/lib/formatBlibliOrderMoney';

type Props = {
  pkg: BlibliOrderPackageGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BlibliOrderDetailDrawer({ pkg, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const items = pkg?.orderItems ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {t('operations.blibliOrders.detailTitle')}
            {pkg?.packageId != null ? ` #${pkg.packageId}` : ''}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('operations.blibliOrders.noItems')}</p>
          ) : (
            items.map((it, idx) => (
              <div key={it.order?.itemId ?? idx} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{it.product?.itemName ?? '—'}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <dt>{t('operations.blibliOrders.orderId')}</dt>
                  <dd className="text-foreground">{it.order?.id ?? '—'}</dd>
                  <dt>{t('operations.blibliOrders.itemId')}</dt>
                  <dd className="text-foreground">{it.order?.itemId ?? '—'}</dd>
                  <dt>{t('operations.blibliOrders.status')}</dt>
                  <dd className="text-foreground">{it.order?.itemStatus ?? '—'}</dd>
                  <dt>{t('operations.blibliOrders.customer')}</dt>
                  <dd className="text-foreground">{it.order?.customerFullName ?? '—'}</dd>
                  <dt>{t('operations.blibliOrders.orderDate')}</dt>
                  <dd className="text-foreground">{formatBlibliEpoch(it.order?.date)}</dd>
                  <dt>SKU</dt>
                  <dd className="text-foreground">{it.product?.sellerSku ?? it.product?.blibliSku ?? '—'}</dd>
                  <dt>{t('operations.blibliOrders.qtyPrice')}</dt>
                  <dd className="text-foreground">
                    {it.order?.quantity ?? 1} ×{' '}
                    {formatBlibliOrderMoney(it.product?.finalPrice ?? it.product?.price)}
                  </dd>
                  <dt>{t('operations.blibliOrders.logistic')}</dt>
                  <dd className="text-foreground">
                    {it.logistic?.productName ?? it.logistic?.productCode ?? '—'}
                  </dd>
                  <dt>AWB</dt>
                  <dd className="text-foreground">{it.logistic?.awbNumber ?? '—'}</dd>
                  <dt>{t('operations.blibliOrders.pickupPoint')}</dt>
                  <dd className="text-foreground">
                    {it.pickupPoint?.name ?? it.pickupPoint?.code ?? '—'}
                  </dd>
                  <dt>{t('operations.blibliOrders.deliveryType')}</dt>
                  <dd className="text-foreground">{it.sellerDeliveryType ?? '—'}</dd>
                </dl>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
