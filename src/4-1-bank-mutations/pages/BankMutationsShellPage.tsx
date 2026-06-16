import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { BankMutationsModuleShell } from '@/4-1-bank-mutations/layout/BankMutationsModuleShell';
import { BankMutationsPageSkeleton } from '@/4-1-bank-mutations/skeletons/BankMutationsPageSkeleton';
import { BankMutationsPage } from './BankMutationsPage';

export default function BankMutationsShellPage() {
  const [showOverlay, setShowOverlay] = useState(true);

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div
        className={cn(showOverlay && 'pointer-events-none invisible')}
        aria-hidden={showOverlay}
      >
        <BankMutationsModuleShell>
          <BankMutationsPage onLoadingOverlayChange={setShowOverlay} />
        </BankMutationsModuleShell>
      </div>

      {showOverlay ? (
        <div
          className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-gray-100"
          aria-busy="true"
        >
          <BankMutationsPageSkeleton variant="full" />
        </div>
      ) : null}
    </div>
  );
}
