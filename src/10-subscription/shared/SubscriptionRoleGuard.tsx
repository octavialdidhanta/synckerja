import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useSubscriptionSelfServiceEnabled } from "@/shared/auth/hooks/useSubscriptionSelfServiceEnabled";
import { isSubscriptionModulePath } from "@/10-subscription/shared/subscriptionSelfService";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";
import { SubscriptionShellSkeleton } from "@/10-subscription/shared/SubscriptionShellSkeleton";
import { SubscriptionOverviewRouteLoadingShell } from "@/10-subscription/shared/SubscriptionOverviewRouteLoadingShell";
import { SubscriptionPlansRouteLoadingShell } from "@/10-subscription/shared/SubscriptionPlansRouteLoadingShell";
import { MobileSubscriptionRoleGuardLoadingShell } from "@/mobile/6-subscription/pages/MobileSubscriptionRoleGuardLoadingShell";

export function SubscriptionRoleGuard() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const selfServiceEnabled = useSubscriptionSelfServiceEnabled();
  const toolsMobile = useToolsModuleMobileViewport();
  const {
    isOwner,
    isAdmin,
    hasOrganization,
    loading,
    centralProfileHydrated,
  } = useCentralizedUserData();

  if (!selfServiceEnabled && isSubscriptionModulePath(pathname)) {
    return <Navigate to="/" replace />;
  }

  const mobileSubscriptionBootstrap = toolsMobile && pathname.startsWith("/subscription");
  const membershipPending = !centralProfileHydrated || loading;

  if (membershipPending) {
    if (mobileSubscriptionBootstrap) {
      return (
        <div
          className="relative flex min-h-[100dvh] flex-1 flex-col bg-background"
          aria-busy="true"
          aria-label={t("subscription.roleGuard.loading")}
        >
          <span className="sr-only">{t("subscription.roleGuard.loading")}</span>
          <MobileSubscriptionRoleGuardLoadingShell />
        </div>
      );
    }
    const isOverviewRoute =
      pathname === "/subscription/overview" || pathname === "/subscription";
    const isPlansRoute = pathname === "/subscription/plans";

    return (
      <div
        className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col"
        aria-busy="true"
        aria-label={t("subscription.roleGuard.loading")}
      >
        <span className="sr-only">{t("subscription.roleGuard.loading")}</span>
        {isOverviewRoute ? (
          <SubscriptionOverviewRouteLoadingShell />
        ) : isPlansRoute ? (
          <SubscriptionPlansRouteLoadingShell />
        ) : (
          <SubscriptionShellSkeleton />
        )}
      </div>
    );
  }

  if (!hasOrganization) {
    return <Navigate to="/" replace />;
  }

  // Match CentralizedUserData ownership (incl. org creator via organization.user_id),
  // not only user_roles — otherwise "View subscription plans" silently bounces to home.
  if (!isOwner && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
