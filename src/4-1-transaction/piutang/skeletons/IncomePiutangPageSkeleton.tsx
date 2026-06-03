import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { IncomeTransactionHeaderSkeleton } from '@/4-1-transaction/skeletons/IncomeTransactionHeaderSkeleton';
import { IncomePiutangContentSkeleton } from './IncomePiutangContentSkeleton';

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Full-page shell mirror — `IncomeTransactionModuleShell` + konten piutang.
 * Guard / Suspense / hard refresh (belum ada shell hidup).
 */
export function IncomePiutangPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('incomes.piutang.loadingAria', 'Memuat piutang');
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={cn(MAIN_SCROLL, 'min-w-0')}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <IncomeTransactionHeaderSkeleton />
              <IncomePiutangContentSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
