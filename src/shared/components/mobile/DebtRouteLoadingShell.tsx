import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { DebtPageSkeleton } from "@/4-2-debt/skeletons/DebtPageSkeleton";
import { MobileDebtShellSkeleton } from "@/mobile/2-debt/pages/MobileDebtPageSkeleton";

/**
 * `PageAccessGuard` loadingShell + Suspense fallback untuk `/expenses/debt`: desktop vs mobile shell.
 */
export function DebtRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return <DebtPageSkeleton />;
  }
  return <MobileDebtShellSkeleton />;
}
