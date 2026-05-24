import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { refreshNativeSafeAreaChromeInsets } from "@/shared/hooks/useNativeSafeAreaCssVars";

const ANDROID_LIGHT_STATUS_BG = "#FFFFFFFF";
/** Header gelap: latar status bar gelap + Style.Dark (ikon terang). */
const ANDROID_DARK_STATUS_BG = "#0f172a";

export type StatusBarHeaderTheme = "light" | "dark" | "livechat";

/**
 * Android: `setOverlaysWebView` + latar + `setStyle`.
 * Capacitor 8: `Style.Light` = ikon/teks gelap untuk latar terang; `Style.Dark` = ikon/teks terang untuk latar gelap.
 * Inset atas dari plugin (`--safe-area-inset-top`).
 */
async function applyNativeStatusBarChrome(headerTheme: StatusBarHeaderTheme): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    /** Hanya `dark` edge-to-edge. `light` + `livechat` = non-overlay (sama pola inset: `--safe-area-inset-top` = 0, tanpa double padding). */
    const overlay = headerTheme === "dark";
    document.documentElement.setAttribute(
      "data-synckerja-status-bar-overlay",
      overlay ? "true" : "false",
    );
    try {
      await StatusBar.setOverlaysWebView({ overlay });
    } catch {
      document.documentElement.setAttribute("data-synckerja-status-bar-overlay", "true");
    }
    refreshNativeSafeAreaChromeInsets();
  }
  /** Live chat: status bar putih (selaras header/edge) → ikon sistem gelap (`Style.Light`). */
  const style = headerTheme === "dark" ? Style.Dark : Style.Light;
  await StatusBar.setStyle({ style });

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    if (headerTheme === "light" || headerTheme === "livechat") {
      await StatusBar.setBackgroundColor({ color: ANDROID_LIGHT_STATUS_BG });
    } else {
      await StatusBar.setBackgroundColor({ color: ANDROID_DARK_STATUS_BG });
    }
  }
}

/**
 * Status bar native: `light` & `livechat` = latar putih + ikon/teks status bar gelap (`Style.Light` per Capacitor 8);
 * `dark` = latar gelap + ikon terang (`Style.Dark`). Live Chat memakai pola inset yang sama seperti `light`.
 * Segarkan lagi saat resume. No-op on web.
 */
export function useStatusBarStyle(headerTheme: StatusBarHeaderTheme) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void applyNativeStatusBarChrome(headerTheme).catch(() => {});

    let removeResume: (() => void) | undefined;
    void App.addListener("resume", () => {
      void applyNativeStatusBarChrome(headerTheme).catch(() => {});
    }).then((handle) => {
      removeResume = () => void handle.remove();
    });

    return () => {
      removeResume?.();
    };
  }, [headerTheme]);
}
