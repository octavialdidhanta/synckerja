import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { shouldUsePosLoginRedirect } from "@/pos-mobile/0-auth/lib/posAuthSurface";
import { PosAuthSurfaceLoading } from "@/pos-mobile/0-auth/layout/PosAuthSurfaceLoading";

function OrganizationAccessLoadingShell({ posSurface }: { posSurface: boolean }) {
  if (posSurface) {
    return <PosAuthSurfaceLoading label="Loading organization" />;
  }
  return (
    <div
      className="flex min-h-[12rem] flex-1 flex-col gap-3 p-4"
      aria-busy
      aria-label="Loading organization"
    >
      <Skeleton className="h-10 w-full max-w-md rounded-md" />
      <Skeleton className="h-4 w-4/5 max-w-lg" />
      <Skeleton className="h-32 w-full flex-1 rounded-lg" />
    </div>
  );
}

/** These pages choose the next step themselves. Bouncing them restarts the same four checks. */
const ONBOARDING_PATHS = new Set([
  "/organization-unavailable",
  "/create-organization",
  "/create-plan",
  "/employee-welcome",
]);

/**
 * Sends a user who has never joined an organization to create one.
 * Sends a user whose organization was removed to the unavailable page.
 * Must sit inside RequireAuth and before SubscriptionExpiryGuard.
 */
export function OrganizationAccessGuard({ children }: { children?: ReactNode }) {
  const { organizationAccessState, centralProfileHydrated, loading } = useCentralizedUserData();
  const location = useLocation();
  const posSurface = shouldUsePosLoginRedirect(location.pathname);

  if (ONBOARDING_PATHS.has(location.pathname)) {
    return children ? <>{children}</> : <Outlet />;
  }

  if (
    !centralProfileHydrated ||
    loading ||
    organizationAccessState === "loading" ||
    organizationAccessState === "orphan_recovering"
  ) {
    return <OrganizationAccessLoadingShell posSurface={posSurface} />;
  }

  if (organizationAccessState === "needs_organization") {
    return <Navigate to="/create-organization" replace state={{ from: location.pathname }} />;
  }

  if (organizationAccessState === "no_membership") {
    return <Navigate to="/organization-unavailable" replace state={{ from: location.pathname }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}
