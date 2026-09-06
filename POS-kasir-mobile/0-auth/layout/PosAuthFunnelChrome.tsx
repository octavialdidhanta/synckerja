import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { PosBrandMark } from "@/pos-mobile/shared/components/PosBrandMark";
import { isPosAuthFunnelPath } from "../lib/isPosAuthFunnelPath";
import { posAuthFlickerLog } from "../lib/posAuthFlickerLog";

const PosAuthFunnelChromeContext = createContext(false);

/** True when the persistent chrome (outside Suspense) owns the brand. */
export function usePosAuthFunnelChrome(): boolean {
  return useContext(PosAuthFunnelChromeContext);
}

/**
 * Brand + viewport live OUTSIDE the route Suspense boundary (no flicker),
 * stacked like employee-welcome: logo then form, optically centered.
 */
export function PosAuthFunnelChrome({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const active = isPosAuthFunnelPath(pathname);

  useEffect(() => {
    posAuthFlickerLog("chrome_path", { pathname, active });
  }, [pathname, active]);

  return (
    <PosAuthFunnelChromeContext.Provider value={active}>
      {active ? (
        <PosAuthViewport>
          <div className="flex w-full shrink-0 translate-y-2 justify-center">
            <PosBrandMark className="!mb-0" />
          </div>
          <div className="-mt-12 flex w-full flex-col items-center sm:-mt-14">{children}</div>
        </PosAuthViewport>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      )}
    </PosAuthFunnelChromeContext.Provider>
  );
}
