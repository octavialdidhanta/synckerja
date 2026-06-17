import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { HeaderAndTab } from '../section/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { IncomeDashboardSkeleton } from '../skeletons/IncomeDashboardSkeleton';

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

type IncomesModuleShellProps = {
  children: ReactNode;
  showContent?: boolean;
};

/**
 * Shared shell for `/incomes/dashboard` inside `AppShellLayout`.
 * Selaras `DebtModuleShell`: `min-h-full` agar konten bisa melampaui viewport dan scroll.
 */
export function IncomesModuleShell({ children, showContent = true }: IncomesModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          'flex min-h-0 w-full min-w-0 flex-1 flex-col',
          !showContent && 'pointer-events-none invisible select-none',
        )}
        aria-hidden={!showContent}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
          <div className={cn(MAIN_SCROLL, 'min-w-0')}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate className="min-w-0 w-full flex flex-col flex-none">
                {children}
              </ModuleShellContentGate>

              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-gray-100"
          aria-busy="true"
        >
          <IncomeDashboardSkeleton />
        </div>
      ) : null}
    </div>
  );
}
