import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import { SubscriptionShellSkeleton } from "@/10-subscription/shared/SubscriptionShellSkeleton";

function canManageSubscription(role: string | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "owner" || r === "admin";
}

export function SubscriptionRoleGuard() {
  const { t } = useTranslation();
  const { data, isLoading } = useUserOrganizations();

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" aria-label={t("subscription.roleGuard.loading")}>
        <span className="sr-only">{t("subscription.roleGuard.loading")}</span>
        <SubscriptionShellSkeleton />
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
