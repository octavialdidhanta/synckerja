import { useCallback } from "react";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";

/**
 * Lock icon on module HeaderAndTab: only when access is resolved and path is denied.
 * Avoids flashing lock while permission config is still loading.
 */
export function useHeaderTabPageAccess() {
  const { canAccessPage, accessDecisionPending } = useDepartmentAccess();

  const isTabLocked = useCallback(
    (pagePath: string) => !accessDecisionPending && !canAccessPage(pagePath),
    [accessDecisionPending, canAccessPage],
  );

  return { isTabLocked, accessDecisionPending };
}
