import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { isPosNativeApp } from "@/shared/native/appSurface";
import { isPosAuthSurface } from "@/pos-mobile/0-auth/lib/posAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";

function isPosPublicAuthPath(pathname: string): boolean {
  return (
    pathname === POS_AUTH_PATHS.welcome ||
    pathname === POS_AUTH_PATHS.register ||
    pathname === POS_AUTH_PATHS.forgotPassword ||
    pathname === POS_AUTH_PATHS.login ||
    pathname.startsWith(`${POS_AUTH_PATHS.login}/`)
  );
}

/**
 * Android hardware back on authenticated POS screens.
 *
 * Do not walk WebView history (often still contains `/pos/login`) and do not
 * `exitApp()` — that dumps the cashier to the Android home screen. Consuming the
 * event keeps the user on the current POS page.
 */
export function usePosNativeHardwareBack() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!isPosNativeApp() && !isPosAuthSurface()) return;
    if (isPosPublicAuthPath(pathname)) return;
    if (!pathname.startsWith("/pos")) return;

    let remove: (() => void) | undefined;
    void App.addListener("backButton", () => {
      // Intentionally no-op: stay on the current authenticated POS screen.
    }).then((handle) => {
      remove = () => void handle.remove();
    });

    return () => remove?.();
  }, [pathname]);
}
