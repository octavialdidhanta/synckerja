import { useCallback } from "react";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";

/**
 * Lock icon on module HeaderAndTab: only when access is resolved and path is denied.
 * Avoids flashing lock while permission config or module access is still loading.
 */
export function useHeaderTabPageAccess() {
  const { canAccessPage, accessDecisionPending, moduleAccessPending } = useDepartmentAccess();

  const isTabLocked = useCallback(
    (pagePath: string) =>
      !accessDecisionPending && !moduleAccessPending && !canAccessPage(pagePath),
    [accessDecisionPending, moduleAccessPending, canAccessPage],
  );

  return { isTabLocked, accessDecisionPending, moduleAccessPending };
}
