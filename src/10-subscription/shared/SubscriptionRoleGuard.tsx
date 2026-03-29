import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";

function canManageSubscription(role: string | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "owner" || r === "admin";
}

export function SubscriptionRoleGuard() {
  const { t } = useTranslation();
  const { data, isLoading } = useUserOrganizations();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        {t("subscription.roleGuard.loading")}
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
