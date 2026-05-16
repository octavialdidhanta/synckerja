import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { IncomeTransactionContentSkeleton } from './IncomeTransactionContentSkeleton';
import { IncomeTransactionHeaderSkeleton } from './IncomeTransactionHeaderSkeleton';

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Full-page shell mirror — `IncomeTransactionModuleShell` + konten.
 * Guard / Suspense / hard refresh (belum ada shell hidup).
 */
export function IncomeTransactionSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('incomes.incomeTransactionList.loadingAria', 'Loading income transactions');
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <div className={cn(MAIN_SCROLL, 'min-w-0')}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <IncomeTransactionHeaderSkeleton />
              <IncomeTransactionContentSkeleton />
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
            <div className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
