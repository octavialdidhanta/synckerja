import { useLocation } from "react-router-dom";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";

/**
 * Controls full-page skeleton overlays on module routes that use {@link ModuleShellContentGate}.
 * When page access is denied, children (and their `onLoadingChange` callbacks) never mount —
 * do not keep the overlay stuck on initial `tabLoading === true`.
 */
export function useModulePageOverlaySkeleton(dataPending: boolean, pagePath?: string) {
  const { pathname } = useLocation();
  const path = pagePath ?? pathname;
  const { canAccessPage, accessDecisionPending } = useDepartmentAccess();
  const { centralProfileHydrated } = useCentralizedUserData();

  const accessReady = centralProfileHydrated && !accessDecisionPending;
  const hasPageAccess = canAccessPage(path);

  const showFullPageSkeleton = accessReady && hasPageAccess && dataPending;

  return { showFullPageSkeleton, accessReady, hasPageAccess };
}
