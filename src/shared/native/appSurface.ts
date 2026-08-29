import { Capacitor } from "@capacitor/core";

/** Office Play / Capacitor appId (`capacitor.config.ts`). */
export const NATIVE_APP_ID_OFFICE = "id.synckerja.app";

/** POS Play / Capacitor appId (`capacitor.config.pos.ts`). */
export const NATIVE_APP_ID_POS = "id.synckerja.pos";

const POS_SURFACE_KEY = "synckerja_pos_surface";

let cachedNativeAppId: string | null | undefined;

/**
 * Resolve native applicationId once (Capacitor `App.getInfo().id`).
 * Call from bootstrap before first paint when possible.
 */
export async function ensureNativeAppSurface(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    cachedNativeAppId = null;
    return;
  }

  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    cachedNativeAppId = info.id || NATIVE_APP_ID_OFFICE;
  } catch {
    cachedNativeAppId = NATIVE_APP_ID_OFFICE;
  }

  if (cachedNativeAppId === NATIVE_APP_ID_POS) {
    try {
      sessionStorage.setItem(POS_SURFACE_KEY, "1");
    } catch {
      /* ignore */
    }
    redirectPosNativeColdStart();
  }
}

function redirectPosNativeColdStart(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path === "/" || path === "") {
    window.history.replaceState(null, "", "/pos" + window.location.search + window.location.hash);
  }
}

/** Sync read after {@link ensureNativeAppSurface}; null on web. */
export function getNativeAppId(): string | null {
  if (!Capacitor.isNativePlatform()) return null;
  if (cachedNativeAppId === undefined) return null;
  return cachedNativeAppId;
}

export function isPosNativeApp(): boolean {
  return getNativeAppId() === NATIVE_APP_ID_POS;
}

export function isOfficeNativeApp(): boolean {
  return getNativeAppId() === NATIVE_APP_ID_OFFICE;
}

/** Custom URL scheme for native OAuth return. */
export function getNativeSsoAppScheme(): string {
  if (isPosNativeApp()) return NATIVE_APP_ID_POS;
  return NATIVE_APP_ID_OFFICE;
}
