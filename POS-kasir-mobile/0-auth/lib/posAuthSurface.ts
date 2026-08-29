import { isPosNativeApp } from "@/shared/native/appSurface";

const POS_SURFACE_KEY = "synckerja_pos_surface";

/** Mark that the user is in the Synckerja POS auth/cashier funnel (session-scoped). */
export function markPosAuthSurface(): void {
  try {
    sessionStorage.setItem(POS_SURFACE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearPosAuthSurface(): void {
  try {
    sessionStorage.removeItem(POS_SURFACE_KEY);
  } catch {
    /* ignore */
  }
}

export function isPosAuthSurface(): boolean {
  if (isPosNativeApp()) return true;
  try {
    return sessionStorage.getItem(POS_SURFACE_KEY) === "1";
  } catch {
    return false;
  }
}

/** True when current path is under `/pos` or POS surface was marked this session. */
export function shouldUsePosLoginRedirect(pathname: string): boolean {
  return pathname === "/pos" || pathname.startsWith("/pos/") || isPosAuthSurface();
}
