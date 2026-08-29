import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { shouldUsePosLoginRedirect } from "@/pos-mobile/0-auth/lib/posAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";

/**
 * Blocks protected routes until `AuthProvider` finishes the initial session check.
 * Must not render `<Outlet />` while loading — otherwise unauthenticated navigation to `/`
 * briefly mounts `AppShellLayout` + home skeleton before redirect to `/login`.
 * POS surface / `/pos*` → `/pos/login`.
 */
export function RequireAuth() {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100"
        aria-busy
        aria-label="Loading"
      >
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (!user) {
    const loginTo = shouldUsePosLoginRedirect(location.pathname)
      ? POS_AUTH_PATHS.login
      : "/login";
    return <Navigate to={loginTo} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
