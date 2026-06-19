import type { ReactNode } from 'react';
import { HeaderAndTab } from '../../section';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Shell `/incomes/piutang` — mirror `EmployeePage` (page scroll, header ikut scroll, tanpa spacer bawah).
 */
export function IncomePiutangModuleShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className={MAIN_SCROLL}>
            <div className="flex min-h-full flex-col">
              <div className="mb-1 flex-shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate pagePath="/incomes/piutang">{children}</ModuleShellContentGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
