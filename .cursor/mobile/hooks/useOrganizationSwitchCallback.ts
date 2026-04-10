import { useCallback } from "react";
import { useCentralizedUserData } from "@/features/1-login/contexts/CentralizedUserDataContext";

/**
 * Callback to run after organization is switched (sidebar or Profile).
 * Same code path so data stays in sync everywhere without manual refresh.
 */
export function useOrganizationSwitchCallback() {
  const { forceRefreshUserData } = useCentralizedUserData();
  return useCallback(() => {
    forceRefreshUserData();
  }, [forceRefreshUserData]);
}
