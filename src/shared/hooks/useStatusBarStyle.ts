import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { refreshNativeSafeAreaChromeInsets } from "@/shared/hooks/useNativeSafeAreaCssVars";

const ANDROID_LIGHT_STATUS_BG = "#FFFFFFFF";
/** Header gelap: latar status bar gelap + Style.Dark (ikon terang). */
const ANDROID_DARK_STATUS_BG = "#0f172a";

export type StatusBarHeaderTheme = "light" | "dark" | "livechat" | "light-overlay";

/**
 * Android: `setOverlaysWebView` + latar + `setStyle`.
 * Capacitor 8: `Style.Light` = ikon/teks gelap untuk latar terang; `Style.Dark` = ikon/teks terang untuk latar gelap.
 * Inset atas dari plugin (`--safe-area-inset-top`).
 *
 * MainActivity Office selalu edge-to-edge (`setDecorFitsSystemWindows(false)`), jadi overlay
 * selalu ON agar `--safe-area-inset-top` terisi dan header `safe-area-top` tidak mentok status bar.
 */
async function applyNativeStatusBarChrome(headerTheme: StatusBarHeaderTheme): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    document.documentElement.setAttribute("data-synckerja-status-bar-overlay", "true");
    try {
      await StatusBar.setOverlaysWebView({ overlay: true });
    } catch {
      // Keep overlay flag so inset CSS still applies even if the plugin call fails.
    }
    refreshNativeSafeAreaChromeInsets();
  }
  /** Live chat / light / light-overlay: status bar terang → ikon sistem gelap (`Style.Light`). */
  const style = headerTheme === "dark" ? Style.Dark : Style.Light;
  await StatusBar.setStyle({ style });

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    if (headerTheme === "light" || headerTheme === "livechat" || headerTheme === "light-overlay") {
      await StatusBar.setBackgroundColor({ color: ANDROID_LIGHT_STATUS_BG });
    } else {
      await StatusBar.setBackgroundColor({ color: ANDROID_DARK_STATUS_BG });
    }
  }
}

/**
 * Status bar native:
 * - `light` / `livechat` / `light-overlay` = ikon gelap + latar putih (livechat: spacer putih di atas header biru)
 * - `dark` = ikon terang + latar gelap
 * Android: selalu edge-to-edge overlay + `--safe-area-inset-top` untuk header/sidebar.
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
