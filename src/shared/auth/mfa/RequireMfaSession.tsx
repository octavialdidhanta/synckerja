import { Navigate, Outlet, useLocation } from "react-router-dom";
import { mfaLoginChallengePath } from "./mfaLoginPaths";
import { useRequireMfaSession } from "./useRequireMfaSession";
import { shouldUsePosLoginRedirect } from "@/pos-mobile/0-auth/lib/posAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";

function AuthResolvingShell() {
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

/**
 * Blocks protected routes until enrolled users complete login MFA (AAL2).
 * Must sit inside `RequireAuth` and outside app layout routes.
 */
export function RequireMfaSession() {
  const location = useLocation();
  const gateStatus = useRequireMfaSession();

  if (gateStatus === "resolving") {
    return <AuthResolvingShell />;
  }

  if (gateStatus === "challenge") {
    const redirectTo = location.pathname + location.search;
    const mfaBase = shouldUsePosLoginRedirect(location.pathname)
      ? POS_AUTH_PATHS.loginMfa
      : "/login/mfa";
    return <Navigate to={mfaLoginChallengePath(redirectTo, mfaBase)} replace />;
  }

  return <Outlet />;
}
