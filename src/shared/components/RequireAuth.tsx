import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";

/**
 * Blocks protected routes until `AuthProvider` finishes the initial session check.
 * Must not render `<Outlet />` while loading — otherwise unauthenticated navigation to `/`
 * briefly mounts `AppShellLayout` + home skeleton before redirect to `/login`.
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
