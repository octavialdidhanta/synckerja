import { useNativeViewportNoPinchZoom } from "@/shared/hooks/useNativeViewportNoPinchZoom";

/**
 * Single mount point: native shell — no pinch zoom, portrait orientation, locked viewport meta.
 * Must stay mounted for the whole app session (placed under `App`).
 */
export function NativeAppDisplayInit() {
  useNativeViewportNoPinchZoom();
  return null;
}
