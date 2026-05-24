import { useCallback } from "react";

/**
 * Navigation chrome (sidebar / mobile footer) shows all items; route + content gates enforce access.
 */
export function useFilteredNavByPageAccess() {
  const canSeeNavPath = useCallback((_path: string) => true, []);

  const filterNavItems = useCallback(<T extends { path: string }>(items: T[]): T[] => items, []);

  return { canSeeNavPath, filterNavItems, accessDecisionPending: false };
}
