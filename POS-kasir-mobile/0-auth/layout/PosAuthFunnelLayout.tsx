import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { PosBrandMark, POS_BRAND_LOGO_SRC } from "@/pos-mobile/shared/components/PosBrandMark";
import { useMarkPosAuthSurface } from "../lib/useMarkPosAuthSurface";
import { PosAuthFunnelShellProvider } from "../lib/PosAuthFunnelShellContext";
import { isPosAuthFunnelPath } from "../lib/isPosAuthFunnelPath";
import { posAuthFlickerLog } from "../lib/posAuthFlickerLog";
import { usePosAuthFunnelChrome } from "./PosAuthFunnelChrome";

/**
 * Funnel step host. When {@link PosAuthFunnelChrome} is active, brand/viewport
 * are already outside Suspense — this only renders the step outlet.
 */
export function PosAuthFunnelLayout() {
  usePosTabletShell();
  useMarkPosAuthSurface();
  const { pathname } = useLocation();
  const chromeOwnsBrand = usePosAuthFunnelChrome();
  const showBrand = !chromeOwnsBrand && isPosAuthFunnelPath(pathname);
  const mountId = useRef(`layout-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    const id = mountId.current;
    posAuthFlickerLog("layout_mount", { id, pathname, chromeOwnsBrand });
    return () => {
      posAuthFlickerLog("layout_unmount", { id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    posAuthFlickerLog("layout_path", {
      id: mountId.current,
      pathname,
      showBrand,
      chromeOwnsBrand,
    });
  }, [pathname, showBrand, chromeOwnsBrand]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => posAuthFlickerLog("logo_preload_ok", { src: POS_BRAND_LOGO_SRC });
    img.onerror = () => posAuthFlickerLog("logo_preload_fail", { src: POS_BRAND_LOGO_SRC });
    img.src = POS_BRAND_LOGO_SRC;
  }, []);

  const step = (
    <Suspense fallback={<span className="sr-only">Loading</span>}>
      <Outlet />
    </Suspense>
  );

  return (
    <PosAuthFunnelShellProvider>
      {chromeOwnsBrand ? (
        step
      ) : (
        <PosAuthViewport>
          {showBrand ? (
            <div className="flex w-full shrink-0 justify-center">
              <PosBrandMark />
            </div>
          ) : null}
          {step}
        </PosAuthViewport>
      )}
    </PosAuthFunnelShellProvider>
  );
}
