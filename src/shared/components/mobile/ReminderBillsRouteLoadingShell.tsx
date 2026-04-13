import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { ReminderBillsPageSkeleton } from "@/4-2-reminder-bills/skeletons/ReminderBillsPageSkeleton";
import { MobileReminderBillsShellSkeleton } from "@/mobile/2-bills/pages/MobileReminderBillsPageSkeleton";

/**
 * `PageAccessGuard` loadingShell + Suspense fallback untuk `/expenses/reminder-bills`: desktop vs mobile shell.
 */
export function ReminderBillsRouteLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) {
    return <ReminderBillsPageSkeleton />;
  }
  return <MobileReminderBillsShellSkeleton />;
}
