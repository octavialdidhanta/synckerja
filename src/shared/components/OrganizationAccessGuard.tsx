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

/**
 * Redirects authenticated users with no org membership after CMS hard delete.
 * Must sit inside RequireAuth and before SubscriptionExpiryGuard.
 */
export function OrganizationAccessGuard({ children }: { children?: ReactNode }) {
  const { organizationAccessState, centralProfileHydrated, loading } = useCentralizedUserData();
  const location = useLocation();
  const posSurface = shouldUsePosLoginRedirect(location.pathname);

  if (location.pathname === "/organization-unavailable") {
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

  if (organizationAccessState === "no_membership") {
    return <Navigate to="/organization-unavailable" replace state={{ from: location.pathname }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}
