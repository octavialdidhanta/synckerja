import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PosAuthFunnelSuspenseFallback } from "./PosAuthFunnelSuspenseFallback";
import { usePosAuthFunnelShell } from "../lib/PosAuthFunnelShellContext";
import { isPosAuthFunnelPath } from "../lib/isPosAuthFunnelPath";
import { posAuthFlickerLog } from "../lib/posAuthFlickerLog";

/**
 * POS auth/access resolving UI.
 * - Inside funnel layout: sr-only (brand owned by chrome/layout).
 * - Funnel paths outside layout: auth fallback (spacer or brand).
 * - Other `/pos/*` (cashier etc.): plain shell — never flash the login logo.
 */
export function PosAuthSurfaceLoading({ label = "Loading" }: { label?: string }) {
  const inFunnelShell = usePosAuthFunnelShell();
  const { pathname } = useLocation();
  const funnelPath = isPosAuthFunnelPath(pathname);

  useEffect(() => {
    posAuthFlickerLog("surface_loading", { label, inFunnelShell, funnelPath, pathname });
  }, [label, inFunnelShell, funnelPath, pathname]);

  if (inFunnelShell) {
    return <span className="sr-only">{label}</span>;
  }

  if (funnelPath) {
    return <PosAuthFunnelSuspenseFallback />;
  }

  return (
    <div
      className="flex min-h-dvh w-full flex-col bg-[#f7f7f7] safe-area-top"
      aria-busy
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}
