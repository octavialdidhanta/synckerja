import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useSubscriptionExpiry } from "@/10-subscription/hooks/useSubscriptionExpiry";
import { useSubscriptionExpiryRealtime } from "@/10-subscription/hooks/useSubscriptionExpiryRealtime";
import { SubscriptionExpiredPage } from "@/10-subscription/shared/SubscriptionExpiredPage";
import { isAllowedWhenExpired } from "@/10-subscription/shared/subscriptionExpiryPolicy";
import { useSubscriptionSelfServiceEnabled } from "@/shared/auth/hooks/useSubscriptionSelfServiceEnabled";

const ONBOARDING_PATHS = new Set([
  "/employee-welcome",
  "/create-organization",
  "/create-plan",
  "/organization-unavailable",
]);

function SubscriptionExpiryPending() {
  return (
    <div className="min-h-[100dvh] bg-background" aria-busy="true" aria-label="Checking subscription">
      <span className="sr-only">Checking subscription</span>
    </div>
  );
}

export function SubscriptionExpiryGuard() {
  const location = useLocation();
  const { user } = useAuth();
  const selfServiceEnabled = useSubscriptionSelfServiceEnabled();
  const { organizationId } = useOrgBootstrapPending();
  const { expiryStatus, statusSettled, error, subscriptionStatus } = useSubscriptionExpiry();

  useSubscriptionExpiryRealtime();

  const isAllowedRoute = isAllowedWhenExpired(location.pathname, {
    subscriptionSelfServiceEnabled: selfServiceEnabled,
  });

  if (!user || isAllowedRoute || ONBOARDING_PATHS.has(location.pathname)) {
    return <Outlet />;
  }

  // Hold the app shell only while this organization's first status is still loading.
  if (organizationId && !statusSettled) {
    return <SubscriptionExpiryPending />;
  }

  // Fail-open when status cannot be loaded (e.g. missing subscription row) to avoid locking entire org.
  if (error || subscriptionStatus === null) {
    if (error) {
      console.warn("[SubscriptionExpiryGuard] subscription status unavailable:", error);
    }
    return <Outlet />;
  }

  if (expiryStatus.isExpired) {
    return <SubscriptionExpiredPage expiryStatus={expiryStatus} selfServiceEnabled={selfServiceEnabled} />;
  }

  return <Outlet />;
}
