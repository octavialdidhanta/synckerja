import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";

/**
 * Tablet POS auth/welcome chrome: light status bar (dark icons on white/off-white).
 */
export function usePosTabletShell() {
  useStatusBarStyle("light");
}
