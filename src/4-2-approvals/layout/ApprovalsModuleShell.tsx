import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

type ApprovalsModuleShellProps = {
  children: ReactNode;
  className?: string;
};

const SCROLL_MAIN =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export function ApprovalsModuleShell({ children, className }: ApprovalsModuleShellProps) {
  return (
    <div className={cn('flex min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans', className)}>
      <div className={SCROLL_MAIN}>
        <div className="flex min-h-full min-w-0 flex-col bg-muted/40 px-4 pb-2">{children}</div>
        <div
          className="h-2 shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
          aria-hidden
        />
      </div>
      <div className="h-0 flex-shrink-0 [@media(max-height:900px)]:h-4" aria-hidden />
    </div>
  );
}

