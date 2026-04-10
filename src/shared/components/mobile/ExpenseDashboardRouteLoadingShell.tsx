import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { ExpenseDashboardSkeleton } from "@/4-2-dashboard/skeletons/ExpenseDashboardSkeleton";
import { MobileExpenseDashboardShellSkeleton } from "@/mobile/2-expense/pages/MobileExpenseDashboardPageSkeleton";

/**
 * `PageAccessGuard` loadingShell for `/expenses/dashboard`: desktop layout vs mobile shell.
 */
export function ExpenseDashboardRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return <ExpenseDashboardSkeleton />;
  }
  return <MobileExpenseDashboardShellSkeleton />;
}
