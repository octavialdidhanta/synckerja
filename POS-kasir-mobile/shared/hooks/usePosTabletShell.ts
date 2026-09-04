import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";

type Options = {
  /**
   * Phone POS (≤767): edge-to-edge status bar + real `--safe-area-inset-top`
   * so chrome (Menu/Bill/…) sits below the battery/clock strip.
   */
  phoneOverlay?: boolean;
};

/**
 * Tablet POS auth/welcome chrome: light status bar (dark icons on white/off-white).
 * Phone overlay mode keeps dark icons but draws under the status bar with safe-area padding.
 */
export function usePosTabletShell(options?: Options) {
  useStatusBarStyle(options?.phoneOverlay ? "light-overlay" : "light");
}
