import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

type ApprovalsModuleShellProps = {
  children: ReactNode;
  className?: string;
};

const SCROLL_MAIN =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Shell `/expenses/approvals` — selaras debt/payment-process:
 * `px-4 pb-2` di luar scroll agar jarak bawah viewport konsisten.
 */
export function ApprovalsModuleShell({ children, className }: ApprovalsModuleShellProps) {
  return (
    <div className={cn('flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans', className)}>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={cn(SCROLL_MAIN, 'min-w-0')}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
