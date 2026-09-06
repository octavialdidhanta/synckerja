import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { mayNeedMfaChallengeSync } from "@/shared/auth/mfa/useRequireMfaSession";
import { ConsultantLivechatRouteLoadingShell } from "@/shared/components/mobile/ConsultantLivechatRouteLoadingShell";
import { HomePageRouteLoadingShell } from "@/shared/components/mobile/HomePageRouteLoadingShell";
import { PosAuthFunnelSuspenseFallback } from "@/pos-mobile/0-auth/layout/PosAuthFunnelSuspenseFallback";
import { posAuthFlickerLog } from "@/pos-mobile/0-auth/lib/posAuthFlickerLog";
import { isPosAuthFunnelPath } from "@/pos-mobile/0-auth/lib/isPosAuthFunnelPath";

/**
 * Top-level route Suspense fallback. Avoid home dashboard skeleton when session is
 * unknown, absent, or pending MFA challenge.
 *
 * Cold-start notification taps often land on lazy routes (livechat) — a near-empty
 * fallback reads as a blank white WebView on Android (`backgroundColor: #ffffff`).
 */
export function AppRoutesSuspenseFallback() {
  const { pathname } = useLocation();
  const { user, session, loading } = useAuth();
  const isHome = pathname === "/";
  const isLivechat = pathname.startsWith("/omnichannel/livechat");
  const isPosAuthFunnel = isPosAuthFunnelPath(pathname);
  const mfaPending = mayNeedMfaChallengeSync(user, session?.access_token);

  useEffect(() => {
    if (!isPosAuthFunnel) return;
    posAuthFlickerLog("app_routes_suspense_fallback", { pathname });
  }, [isPosAuthFunnel, pathname]);

  if (isPosAuthFunnel) {
    return <PosAuthFunnelSuspenseFallback />;
  }

  if (isLivechat) {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
      >
        <ConsultantLivechatRouteLoadingShell />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

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
