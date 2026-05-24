import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { HeaderAndTab } from '../section/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { ExpenseDashboardSkeleton } from '../skeletons/ExpenseDashboardSkeleton';

type ExpenseDashboardModuleShellProps = {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  showContent: boolean;
};

const SCROLL_MAIN =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Shared outer shell untuk `/expenses/dashboard`.
 * - Satu scroll container
 * - HeaderAndTab ikut terscroll
 * - Skeleton overlay saat data belum siap
 */
export function ExpenseDashboardModuleShell({
  children,
  activeTab,
  onTabChange,
  showContent,
}: ExpenseDashboardModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div
            className={cn(
              SCROLL_MAIN,
              'min-w-0 flex flex-col',
              !showContent && 'pointer-events-none invisible select-none',
            )}
            aria-hidden={!showContent}
          >
            <div className="flex w-full min-h-0 flex-1 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab activeTab={activeTab} onTabChange={onTabChange} />
              </div>

              <ModuleShellContentGate>{children}</ModuleShellContentGate>

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

          {!showContent ? (
            <div
              className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-auto bg-gray-100"
              aria-busy
            >
              <ExpenseDashboardSkeleton />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

