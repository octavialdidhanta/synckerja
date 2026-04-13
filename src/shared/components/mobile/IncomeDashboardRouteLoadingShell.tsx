import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { IncomeDashboardSkeleton } from "@/4-1-dashboard/skeletons/IncomeDashboardSkeleton";
import { MobileIncomeDashboardShellSkeleton } from "@/mobile/3-dashboard/pages/MobileIncomeDashboardViewportSkeleton";

/** `PageAccessGuard` loadingShell for `/incomes/dashboard`: desktop vs mobile chrome skeleton. */
export function IncomeDashboardRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return <IncomeDashboardSkeleton />;
  }
  return <MobileIncomeDashboardShellSkeleton />;
}
