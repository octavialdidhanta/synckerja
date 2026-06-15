import { lazy, Suspense } from 'react';
import { BankMutationsPageSkeleton } from '@/4-1-bank-mutations/skeletons/BankMutationsPageSkeleton';

const BankMutationsShellPage = lazy(() => import('@/4-1-bank-mutations/pages/BankMutationsShellPage'));

export function BankMutationsRouteElement() {
  return (
    <Suspense fallback={<BankMutationsPageSkeleton />}>
      <BankMutationsShellPage />
    </Suspense>
  );
}
