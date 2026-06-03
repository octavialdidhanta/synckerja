import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { HeaderAndTab } from '../section';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';

type IncomeTransactionModuleShellProps = {
  children: ReactNode;
};

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Shared shell for `/incomes/transaction` and `/incomes/piutang`.
 * Selaras `/expenses/*`: `px-4 pb-2` di luar scroll; jarak bawah hanya dari `pb-2`.
 */
export function IncomeTransactionModuleShell({ children }: IncomeTransactionModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className={cn(MAIN_SCROLL, 'min-w-0')}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate>{children}</ModuleShellContentGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
