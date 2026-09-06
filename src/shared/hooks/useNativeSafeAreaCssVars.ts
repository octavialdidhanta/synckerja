import { useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { CONTENT_SCROLL_EXTRA_BOTTOM_VAR } from "@/shared/native/contentScrollExtraBottom";
import { triggerMobileLayoutReflow } from "@/shared/mobile/triggerMobileLayoutReflow";

/** Dipancarkan setelah `SplashScreen.hide()` agar inset footer dibaca ulang (cold start). */
export const SYNCKERJA_SPLASH_HIDDEN_EVENT = "synckerja-splash-hidden";

interface SafeAreaInsetsPlugin {
  getInsets(): Promise<{ top: number; bottom: number }>;
}

const SafeAreaInsets = registerPlugin<SafeAreaInsetsPlugin>("SafeAreaInsets");

const MAX_FOOTER_BOTTOM_INSET_PX = 56;

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * `true` = status bar menindih WebView (edge-to-edge); perlu inset atas dari plugin.
 * `false`/unset = WebView di bawah status bar; inset atas plugin membuat header turun ganda.
 */
function statusBarOverlaysWebViewFromDom(): boolean {
  return document.documentElement.getAttribute("data-synckerja-status-bar-overlay") === "true";
}

/** `--safe-area-inset-top` + `--footer-bottom-inset` / `--content-scroll-extra-bottom` untuk kelas utility. */
async function applyInsetsToDocument(): Promise<void> {
  const { top, bottom } = await SafeAreaInsets.getInsets();
  const topInsetPx = statusBarOverlaysWebViewFromDom() ? Math.max(0, top) : 0;
  document.documentElement.style.setProperty("--safe-area-inset-top", `${topInsetPx}px`);
  const bottomInsetPx = clamp(bottom, 0, MAX_FOOTER_BOTTOM_INSET_PX);
  document.documentElement.style.setProperty(CONTENT_SCROLL_EXTRA_BOTTOM_VAR, `${bottomInsetPx}px`);
  document.documentElement.style.setProperty("--footer-bottom-inset", `${bottomInsetPx}px`);
  // Alias for legacy utilities (`.safe-area-bottom`, sheets) — same clamped plugin bottom.
  document.documentElement.style.setProperty("--safe-area-inset-bottom", `${bottomInsetPx}px`);
}

export function refreshNativeSafeAreaChromeInsets(): void {
  void applyInsetsToDocument().catch(() => {});
}

function applyAllChromeInsets(): void {
  refreshNativeSafeAreaChromeInsets();
}

/**
 * Android native: `--safe-area-inset-top` + variabel footer/scroll untuk kelas legacy (plugin SafeAreaInsets).
 */
export function useNativeSafeAreaCssVars(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

    const refreshAfterLayout = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyAllChromeInsets();
          triggerMobileLayoutReflow();
        });
      });
    };

    const scheduleDelayedRefreshes = () => {
      refreshAfterLayout();
      const t100 = window.setTimeout(applyAllChromeInsets, 100);
      const t400 = window.setTimeout(applyAllChromeInsets, 400);
      return () => {
        window.clearTimeout(t100);
        window.clearTimeout(t400);
      };
    };

    const refreshChromeAfterForeground = () => {
      refreshAfterLayout();
      return () => {};
    };

    let cancelDelayed = scheduleDelayedRefreshes();

    const onSplashHidden = () => {
      applyAllChromeInsets();
    };
    window.addEventListener(SYNCKERJA_SPLASH_HIDDEN_EVENT, onSplashHidden);

    const onPageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) return;
      applyAllChromeInsets();
    };
    window.addEventListener("pageshow", onPageShow);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      cancelDelayed();
      cancelDelayed = refreshChromeAfterForeground();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let removeResume: (() => void) | undefined;
    void App.addListener("resume", () => {
      cancelDelayed();
      cancelDelayed = refreshChromeAfterForeground();
    }).then((handle) => {
      removeResume = () => void handle.remove();
    });

    return () => {
      cancelDelayed();
      window.removeEventListener(SYNCKERJA_SPLASH_HIDDEN_EVENT, onSplashHidden);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      removeResume?.();
    };
  }, []);
}

/** Mount sekali di App shell; tidak merender UI. */
export function NativeSafeAreaCssVarsInit() {
  useNativeSafeAreaCssVars();
  return null;
}
