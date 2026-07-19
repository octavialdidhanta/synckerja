import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import type { BlibliOrderPackageGroup } from '@/blibli-orders/hooks/useBlibliOrderPackagesQuery';
import { statusBadgeVariant } from '@/blibli-orders/lib/blibliOrderStatusTabs';
import {
  formatBlibliEpoch,
  formatBlibliOrderMoney,
} from '@/blibli-orders/lib/formatBlibliOrderMoney';
import { ecommerceChatPlatformPath } from '@/6-0-ecommerce-chat/lib/ecommerceChatPaths';

type Props = {
  pkg: BlibliOrderPackageGroup;
  onOpenDetail: (pkg: BlibliOrderPackageGroup) => void;
};

export function BlibliOrderPackageCard({ pkg, onOpenDetail }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = pkg.orderItems ?? [];
  const primary = items[0];
  const order = primary?.order;
  const product = primary?.product;
  const logistic = primary?.logistic;
  const pickup = primary?.pickupPoint;
  const status = order?.itemStatus ?? '—';
  const extraCount = Math.max(0, items.length - 1);
  const total = items.reduce((sum, it) => {
    const qty = Number(it.order?.quantity ?? 1) || 1;
    const price = Number(it.product?.finalPrice ?? it.product?.price ?? 0) || 0;
    return sum + qty * price;
  }, 0);

  return (
    <article className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex min-w-0 items-start gap-2">
          <input type="checkbox" className="mt-1" disabled aria-hidden />
          <div className="min-w-0">
            <button
              type="button"
              className="text-sm font-semibold text-primary hover:underline"
              onClick={() => onOpenDetail(pkg)}
            >
              {order?.id ?? pkg.packageId ?? '—'}
            </button>
            <p className="text-xs text-muted-foreground">
              {order?.customerFullName ?? '—'}
              {' · '}
              {formatBlibliEpoch(order?.date)}
            </p>
            {pkg.packageId != null && (
              <p className="text-[11px] text-muted-foreground">
                {t('operations.blibliOrders.packageId')}: {String(pkg.packageId)}
              </p>
            )}
          </div>
        </div>
        <Badge variant={statusBadgeVariant(status)} className="shrink-0">
          {status}
        </Badge>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-12">
        <div className="min-w-0 md:col-span-5">
          <p className="truncate text-sm font-medium">{product?.itemName ?? '—'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[product?.blibliSku, product?.sellerSku].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="mt-1 text-xs">
            {order?.quantity ?? 1} × {formatBlibliOrderMoney(product?.finalPrice ?? product?.price)}
          </p>
          {extraCount > 0 && (
            <button
              type="button"
              className="mt-1 text-xs text-primary hover:underline"
              onClick={() => onOpenDetail(pkg)}
            >
              {t('operations.blibliOrders.otherProducts', { count: extraCount })}
            </button>
          )}
        </div>

        <div className="space-y-1 text-xs text-muted-foreground md:col-span-4">
          <p>
            <span className="font-medium text-foreground">{t('operations.blibliOrders.logistic')}:</span>{' '}
            {logistic?.productName ?? logistic?.productCode ?? '—'}
          </p>
          <p>
            <span className="font-medium text-foreground">AWB:</span>{' '}
            {logistic?.awbNumber ?? '—'}
          </p>
          <p>
            <span className="font-medium text-foreground">{t('operations.blibliOrders.pickupPoint')}:</span>{' '}
            {pickup?.name ?? pickup?.code ?? '—'}
          </p>
        </div>

        <div className="flex flex-col items-stretch justify-between gap-2 md:col-span-3 md:items-end">
          <p className="text-sm font-semibold">
            {t('operations.blibliOrders.totalOrder')}: {formatBlibliOrderMoney(total)}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled>
                      {t('operations.blibliOrders.cancel')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('operations.blibliOrders.comingSoon')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate(ecommerceChatPlatformPath('blibli'))}
            >
              <MessageSquare className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t('operations.blibliOrders.chatCustomer')}
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button type="button" size="sm" disabled>
                      {t('operations.blibliOrders.createPackage')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('operations.blibliOrders.comingSoon')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </article>
  );
}
