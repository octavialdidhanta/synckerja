import { useLocation } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { mayNeedMfaChallengeSync } from "@/shared/auth/mfa/useRequireMfaSession";
import { HomePageRouteLoadingShell } from "@/shared/components/mobile/HomePageRouteLoadingShell";

/**
 * Top-level route Suspense fallback. Avoid home dashboard skeleton when session is
 * unknown, absent, or pending MFA challenge.
 */
export function AppRoutesSuspenseFallback() {
  const { pathname } = useLocation();
  const { user, session, loading } = useAuth();
  const isHome = pathname === "/";
  const mfaPending = mayNeedMfaChallengeSync(user, session?.access_token);

  if (isHome && (loading || !user || mfaPending)) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (isHome) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <HomePageRouteLoadingShell />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center bg-gray-50" aria-busy>
      <span className="sr-only">Loading</span>
    </div>
  );
}
