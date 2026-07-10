import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSubscriptionSelfServiceEnabled } from "@/shared/auth/hooks/useSubscriptionSelfServiceEnabled";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import { isSubscriptionModulePath } from "@/10-subscription/shared/subscriptionSelfService";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";
import { SubscriptionShellSkeleton } from "@/10-subscription/shared/SubscriptionShellSkeleton";
import { SubscriptionOverviewRouteLoadingShell } from "@/10-subscription/shared/SubscriptionOverviewRouteLoadingShell";
import { SubscriptionPlansRouteLoadingShell } from "@/10-subscription/shared/SubscriptionPlansRouteLoadingShell";
import { MobileSubscriptionRoleGuardLoadingShell } from "@/mobile/6-subscription/pages/MobileSubscriptionRoleGuardLoadingShell";

function canManageSubscription(role: string | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "owner" || r === "admin";
}

export function SubscriptionRoleGuard() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const selfServiceEnabled = useSubscriptionSelfServiceEnabled();
  const toolsMobile = useToolsModuleMobileViewport();
  const { data, isLoading } = useUserOrganizations();

  if (!selfServiceEnabled && isSubscriptionModulePath(pathname)) {
    return <Navigate to="/" replace />;
  }

  const mobileSubscriptionBootstrap = toolsMobile && pathname.startsWith("/subscription");

  if (isLoading) {
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

  const activeId = data?.activeOrganizationId;
  if (!activeId) {
    return <Navigate to="/" replace />;
  }

  const membership = data?.memberships.find((m) => m.organizationId === activeId);
  if (!canManageSubscription(membership?.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
