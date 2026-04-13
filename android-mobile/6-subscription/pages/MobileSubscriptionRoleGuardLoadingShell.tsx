import { useLocation } from "react-router-dom";
import {
  SUBSCRIPTION_MANAGEMENT_PATH,
  SUBSCRIPTION_OVERVIEW_PATH,
  SUBSCRIPTION_PLANS_PATH,
} from "@/mobile/6-subscription/shared/mobileSubscriptionNavPaths";
import { MobileSubscriptionOverviewPageSkeletonOverlay } from "@/mobile/6-subscription/pages/MobileSubscriptionOverviewPageSkeletonOverlay";
import { MobileSubscriptionPlansPageSkeletonOverlay } from "@/mobile/6-subscription/pages/MobileSubscriptionPlansPageSkeletonOverlay";
import { MobileSubscriptionManagementPageSkeletonOverlay } from "@/mobile/6-subscription/pages/MobileSubscriptionManagementPageSkeletonOverlay";

function pathMatches(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Satu jenis shell skeleton mobile untuk fase `SubscriptionRoleGuard` (bukan `SubscriptionShellSkeleton` desktop).
 */
export function MobileSubscriptionRoleGuardLoadingShell() {
  const { pathname } = useLocation();

  if (pathMatches(pathname, SUBSCRIPTION_MANAGEMENT_PATH)) {
    return <MobileSubscriptionManagementPageSkeletonOverlay />;
  }
  if (pathMatches(pathname, SUBSCRIPTION_PLANS_PATH)) {
    return <MobileSubscriptionPlansPageSkeletonOverlay />;
  }
  return <MobileSubscriptionOverviewPageSkeletonOverlay />;
}
