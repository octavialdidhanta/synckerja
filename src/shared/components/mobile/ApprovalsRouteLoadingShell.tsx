import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { ApprovalsPageSkeleton } from "@/4-2-approvals/skeletons/ApprovalsPageSkeleton";
import { MobileApprovalsShellSkeleton } from "@/mobile/2-approvals/pages/MobileApprovalsPageSkeleton";

/**
 * `PageAccessGuard` loadingShell + Suspense fallback untuk `/expenses/approvals`: desktop vs mobile shell.
 */
export function ApprovalsRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return <ApprovalsPageSkeleton />;
  }
  return <MobileApprovalsShellSkeleton />;
}
