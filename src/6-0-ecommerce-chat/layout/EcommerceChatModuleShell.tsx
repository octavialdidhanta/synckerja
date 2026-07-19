import type { ReactNode } from 'react';
import { EcommerceChatHeaderAndTab } from '../container/EcommerceChatHeaderAndTab';
import { ModuleHeaderBelowContentGate } from '@/shared/layouts/ModuleHeaderBelowContentGate';
import { ECOMMERCE_CHAT_PAGE_PATH } from '../lib/ecommerceChatPaths';

type EcommerceChatModuleShellProps = {
  children: ReactNode;
};

export function EcommerceChatModuleShell({ children }: EcommerceChatModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 w-full flex-1 flex-col">
              <ModuleHeaderBelowContentGate
                pagePath={ECOMMERCE_CHAT_PAGE_PATH}
                header={<EcommerceChatHeaderAndTab />}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                {children}
              </ModuleHeaderBelowContentGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
