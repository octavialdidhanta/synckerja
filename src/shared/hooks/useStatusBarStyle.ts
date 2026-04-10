import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

/**
 * Android status bar icon style. 'light' header → dark icons (Style.Light).
 * No-op on web.
 */
export function useStatusBarStyle(headerTheme: "light" | "dark") {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const style = headerTheme === "dark" ? Style.Dark : Style.Light;
    StatusBar.setStyle({ style }).catch(() => {});
  }, [headerTheme]);
}
