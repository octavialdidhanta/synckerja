import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { IncomeTransactionHeaderSkeleton } from '@/4-1-transaction/skeletons/IncomeTransactionHeaderSkeleton';
import { IncomePiutangContentSkeleton } from './IncomePiutangContentSkeleton';

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Full-page shell mirror — `IncomePiutangModuleShell` + konten piutang.
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
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className={MAIN_SCROLL}>
            <div className="flex min-h-full flex-col">
              <div className="mb-1 flex-shrink-0">
                <IncomeTransactionHeaderSkeleton />
              </div>
              <IncomePiutangContentSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
