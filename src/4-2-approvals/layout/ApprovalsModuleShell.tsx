import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { HeaderAndTab } from '@/4-2-dashboard/section/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { ApprovalsPageSkeleton } from '@/4-2-approvals/skeletons/ApprovalsPageSkeleton';

type ApprovalsModuleShellProps = {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  showContent: boolean;
  className?: string;
};

const SCROLL_MAIN =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Shared outer shell untuk `/expenses/approvals`.
 * - Header ikut scroll (selaras `/expenses/reminder-bills`)
 * - Skeleton overlay saat data belum siap
 */
export function ApprovalsModuleShell({
  children,
  activeTab,
  onTabChange,
  showContent,
  className,
}: ApprovalsModuleShellProps) {
  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans',
        className,
      )}
    >
      <div
        className={cn(
          'flex min-h-0 w-full min-w-0 flex-1 flex-col',
          !showContent && 'pointer-events-none invisible select-none',
        )}
        aria-hidden={!showContent}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
            <div className={cn(SCROLL_MAIN, 'min-w-0')}>
              <div className="flex min-h-full flex-col bg-muted/40">
                <div className="mb-1 min-w-0 flex-shrink-0">
                  <HeaderAndTab activeTab={activeTab} onTabChange={onTabChange} />
                </div>

                <ModuleShellContentGate pagePath="/expenses/approvals">
                  {children}
                </ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
          aria-busy
        >
          <ApprovalsPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}
