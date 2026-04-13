import { useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";

/** Selaras synckerja-reference: tanpa `viewport-fit=cover` (hindari env inset ganda di WebView). */
const LOCKED_VIEWPORT =
  "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no";

interface ZoomDisablePlugin {
  ensureZoomDisabled(): Promise<void>;
}

const ZoomDisable = registerPlugin<ZoomDisablePlugin>("ZoomDisable");

/**
 * Capacitor only: lock meta viewport, disable WebView zoom, and lock portrait.
 * Applied once per app session (no cleanup) so navigation does not re-enable zoom.
 */
export function useNativeViewportNoPinchZoom(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    if (Capacitor.getPlatform() === "android") {
      document.documentElement.setAttribute("data-synckerja-android-native", "true");
    }

    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute("content", LOCKED_VIEWPORT);
    }

    if (Capacitor.isPluginAvailable("ZoomDisable")) {
      void ZoomDisable.ensureZoomDisabled().catch(() => {});
    }

    void ScreenOrientation.lock({ orientation: "portrait-primary" }).catch(() => {});
  }, []);
}
