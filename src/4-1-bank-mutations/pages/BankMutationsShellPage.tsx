import { useState } from 'react';
import { BankMutationsModuleShell } from '@/4-1-bank-mutations/layout/BankMutationsModuleShell';
import { BankMutationsPage } from './BankMutationsPage';

export default function BankMutationsShellPage() {
  const [showContent, setShowContent] = useState(false);

  return (
    <BankMutationsModuleShell showContent={showContent}>
      <BankMutationsPage onLoadingOverlayChange={(showSkeleton) => setShowContent(!showSkeleton)} />
    </BankMutationsModuleShell>
  );
}
