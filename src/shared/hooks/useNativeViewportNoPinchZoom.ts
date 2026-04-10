import { useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

const DEFAULT_VIEWPORT = "width=device-width, initial-scale=1.0";
const LOCKED_VIEWPORT =
  "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no";

interface ZoomDisablePlugin {
  ensureZoomDisabled(): Promise<void>;
}

const ZoomDisable = registerPlugin<ZoomDisablePlugin>("ZoomDisable");

/**
 * Capacitor only: lock meta viewport + WebView zoom so pinch zoom is off.
 * Restores previous viewport on unmount (e.g. when leaving the screen).
 */
export function useNativeViewportNoPinchZoom(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const meta = document.querySelector('meta[name="viewport"]');
    const previous = meta?.getAttribute("content") ?? DEFAULT_VIEWPORT;
    if (meta) {
      meta.setAttribute("content", LOCKED_VIEWPORT);
    }

    if (Capacitor.isPluginAvailable("ZoomDisable")) {
      void ZoomDisable.ensureZoomDisabled().catch(() => {});
    }

    return () => {
      if (meta) meta.setAttribute("content", previous);
    };
  }, []);
}
