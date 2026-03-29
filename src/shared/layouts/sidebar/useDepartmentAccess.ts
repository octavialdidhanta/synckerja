import { useCallback } from "react";

/**
 * Legacy hook from old `1-layouts`: gate tool tabs by department/role.
 * No department rules are configured in nav yet — allow all paths so Tools tabs stay usable.
 */
export function useDepartmentAccess() {
  const canAccessPage = useCallback((_path: string) => true, []);
  return { canAccessPage };
}
