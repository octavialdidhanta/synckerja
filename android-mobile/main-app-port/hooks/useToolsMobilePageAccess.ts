import { useDepartmentAccess } from '@/shared/auth/page-access/useDepartmentAccess';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

export function useToolsMobilePageAccess(pagePath: string) {
  const { canAccessPage, accessDecisionPending } = useDepartmentAccess();
  const { centralProfileHydrated } = useCentralizedUserData();

  const accessReady = centralProfileHydrated && !accessDecisionPending;
  const hasPageAccess = accessReady && canAccessPage(pagePath);
  const showDenyShellHeader = accessReady && !canAccessPage(pagePath);

  return { accessReady, hasPageAccess, showDenyShellHeader };
}
