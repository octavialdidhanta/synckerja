import { useEffect, useState } from 'react';
import { useDepartmentAccess } from '@/shared/auth/page-access/useDepartmentAccess';
import { BANK_MUTATIONS_BASE_PATH } from '@/4-1-bank-mutations/lib/bankMutationsPaths';
import { BankMutationsModuleShell } from '@/4-1-bank-mutations/layout/BankMutationsModuleShell';
import { BankMutationsPage } from './BankMutationsPage';

export default function BankMutationsShellPage() {
  const { canAccessPage, accessDecisionPending } = useDepartmentAccess();
  const hasPageAccess = canAccessPage(BANK_MUTATIONS_BASE_PATH);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!accessDecisionPending && !hasPageAccess) {
      setShowContent(true);
    }
  }, [accessDecisionPending, hasPageAccess]);

  return (
    <BankMutationsModuleShell showContent={showContent}>
      <BankMutationsPage onLoadingOverlayChange={(showSkeleton) => setShowContent(!showSkeleton)} />
    </BankMutationsModuleShell>
  );
}
