import { isPosAuthSurface } from "./posAuthSurface";

/** Paths that use the POS auth funnel chrome (stable brand above Suspense). */
export function isPosAuthFunnelPath(pathname: string): boolean {
  if (
    pathname === "/pos" ||
    pathname.startsWith("/pos/login") ||
    pathname === "/pos/register" ||
    pathname === "/pos/forgot-password" ||
    pathname === "/pos/select-outlet"
  ) {
    return true;
  }
  // Keep chrome mounted after MFA → welcome aboard (logcat: brand remount hop).
  if (pathname === "/employee-welcome" && isPosAuthSurface()) {
    return true;
  }
  return false;
}
