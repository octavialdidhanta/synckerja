import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import type { BlibliOrderPackageGroup } from '@/blibli-orders/hooks/useBlibliOrderPackagesQuery';
import type { BlibliOrdersPaging } from '@/blibli-orders/hooks/useBlibliOrderPackagesQuery';
import { BlibliOrderPackageCard } from './BlibliOrderPackageCard';

type Props = {
  packages: BlibliOrderPackageGroup[];
  paging: BlibliOrdersPaging | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onOpenDetail: (pkg: BlibliOrderPackageGroup) => void;
  onPageChange: (page: number) => void;
};

export function BlibliOrdersList({
  packages,
  paging,
  isLoading,
  isError,
  errorMessage,
  onOpenDetail,
  onPageChange,
}: Props) {
  const { t } = useTranslation();
  const page = paging?.pageNumber ?? 0;
  const totalPage = paging?.totalPage ?? 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <p className="text-sm">{t('operations.blibliOrders.loadingOrders')}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('operations.blibliOrders.loadErrorTitle')}</AlertTitle>
        <AlertDescription>
          {errorMessage || t('operations.blibliOrders.loadErrorBody')}
        </AlertDescription>
      </Alert>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-1 px-4 text-center">
        <p className="text-sm font-medium">{t('operations.blibliOrders.emptyTitle')}</p>
        <p className="max-w-md text-xs text-muted-foreground">
          {t('operations.blibliOrders.emptyBody')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {packages.map((pkg, idx) => (
        <BlibliOrderPackageCard
          key={`${pkg.packageId ?? 'p'}-${pkg.orderItems?.[0]?.order?.itemId ?? idx}`}
          pkg={pkg}
          onOpenDetail={onOpenDetail}
        />
      ))}

      {totalPage > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-xs text-muted-foreground">
            {t('operations.blibliOrders.pageOf', {
              page: page + 1,
              total: totalPage,
              records: paging?.totalRecord ?? 0,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 0}
              onClick={() => onPageChange(page - 1)}
            >
              {t('operations.blibliOrders.prevPage')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page + 1 >= totalPage}
              onClick={() => onPageChange(page + 1)}
            >
              {t('operations.blibliOrders.nextPage')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
