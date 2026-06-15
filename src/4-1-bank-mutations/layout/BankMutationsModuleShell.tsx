import type { ReactNode } from 'react';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { BANK_MUTATIONS_BASE_PATH } from '@/4-1-bank-mutations/lib/bankMutationsPaths';
import { BankMutationsPageHeader } from '@/4-1-bank-mutations/section/BankMutationsPageHeader';

type BankMutationsModuleShellProps = {
  children: ReactNode;
};

export function BankMutationsModuleShell({ children }: BankMutationsModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden">
          <div className="mb-1 min-w-0 flex-shrink-0">
            <BankMutationsPageHeader />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ModuleShellContentGate pagePath={BANK_MUTATIONS_BASE_PATH}>
              {children}
            </ModuleShellContentGate>
          </div>
        </div>
      </div>
    </div>
  );
}
