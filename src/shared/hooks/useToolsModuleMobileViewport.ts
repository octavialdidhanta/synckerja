import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";

/** Selaras Tailwind `lg`: lebar ≤1023px = shell mobile modul tools (bukan `AppHeader` desktop). */
const TOOLS_MOBILE_SHELL_MQ = "(max-width: 1023px)";

function subscribeToolsMobileShell(callback: () => void) {
  const mql = window.matchMedia(TOOLS_MOBILE_SHELL_MQ);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getToolsMobileShellSnapshot() {
  if (Capacitor.isNativePlatform()) return true;
  return window.matchMedia(TOOLS_MOBILE_SHELL_MQ).matches;
}

/**
 * Dipakai `DailyTaskRouteElement`, `MeetingNotesRouteElement`, `ConsultantLivechatRouteElement`, dan `AdaptiveAppLayout`: putuskan shell android-mobile vs modul desktop,
 * serta apakah route tools boleh melewati `AppShellLayout` (tanpa `AppHeader` PT Synckerja).
 */
export function useToolsModuleMobileViewport() {
  return useSyncExternalStore(
    subscribeToolsMobileShell,
    getToolsMobileShellSnapshot,
    () => true,
  );
}
