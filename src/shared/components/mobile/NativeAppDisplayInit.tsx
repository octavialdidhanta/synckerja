import { useNativeViewportNoPinchZoom } from "@/shared/hooks/useNativeViewportNoPinchZoom";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";

/**
 * Single mount point: native shell — no pinch zoom, portrait orientation, locked viewport meta.
 * Must stay mounted for the whole app session (placed under `App`).
 */
export function NativeAppDisplayInit() {
  useNativeViewportNoPinchZoom();
  /** Baseline strip status bar putih; halaman gelap (Live Chat) menimpa lewat hook sendiri. */
  useStatusBarStyle("light");
  return null;
}
