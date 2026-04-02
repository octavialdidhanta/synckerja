import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { HeaderAndTab } from '@/4-2-dashboard/section/HeaderAndTab';
import { DebtPageSkeleton } from '@/4-2-debt/skeletons/DebtPageSkeleton';

type DebtModuleShellProps = {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  showContent: boolean;
};

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Shared outer shell untuk `/expenses/debt`.
 * - Satu scroll container (header ikut scroll)
 * - Bottom safe spacer
 * - Skeleton overlay saat data belum siap
 */
export function DebtModuleShell({ children, activeTab, onTabChange, showContent }: DebtModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          'flex min-h-0 w-full min-w-0 flex-1 flex-col',
          !showContent && 'pointer-events-none invisible select-none',
        )}
        aria-hidden={!showContent}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
            <div className={cn(MAIN_SCROLL, 'min-w-0')}>
              <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
                <div className="mb-1 min-w-0 flex-shrink-0">
                  <HeaderAndTab activeTab={activeTab} onTabChange={onTabChange} />
                </div>

                {children}

                <div
                  className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                  aria-hidden
                />
              </div>
            </div>

            <div
              className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4"
              aria-hidden
            />
          </div>
        </div>
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
          aria-busy
        >
          <DebtPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}

