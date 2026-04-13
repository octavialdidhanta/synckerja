import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { refreshNativeSafeAreaChromeInsets } from "@/shared/hooks/useNativeSafeAreaCssVars";

const ANDROID_LIGHT_STATUS_BG = "#ffffff";
/** Header gelap: latar status bar gelap + Style.Dark (ikon terang). */
const ANDROID_DARK_STATUS_BG = "#0f172a";
/** Fallback bila `--primary` belum terbaca (≈ hsl(204 70% 42%)). */
const ANDROID_LIVECHAT_PRIMARY_FALLBACK = "#207ab6";

function hslToRgb255(hDeg: number, sPct: number, lPct: number): [number, number, number] {
  const h = hDeg / 360;
  const s = sPct / 100;
  const l = lPct / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** `--primary` format shadcn: `H S% L%` (spasi). */
function readPrimaryBackgroundHexForStatusBar(): string {
  if (typeof document === "undefined") return ANDROID_LIVECHAT_PRIMARY_FALLBACK;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return ANDROID_LIVECHAT_PRIMARY_FALLBACK;
  const h = Number.parseFloat(parts[0]!);
  const s = Number.parseFloat(parts[1]!.replace("%", ""));
  const l = Number.parseFloat(parts[2]!.replace("%", ""));
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) {
    return ANDROID_LIVECHAT_PRIMARY_FALLBACK;
  }
  const [r, g, b] = hslToRgb255(h, s, l);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export type StatusBarHeaderTheme = "light" | "dark" | "livechat";

/**
 * Android: `setOverlaysWebView` + latar + `setStyle`. Tema terang = putih + `Style.Light` (ikon gelap per API Capacitor).
 * Inset atas tetap dari plugin (`--safe-area-inset-top`), bukan dari tebak-tebak padding ganda.
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
  const style =
    headerTheme === "dark" || headerTheme === "livechat" ? Style.Dark : Style.Light;
  await StatusBar.setStyle({ style });

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    if (headerTheme === "light") {
      await StatusBar.setBackgroundColor({ color: ANDROID_LIGHT_STATUS_BG });
    } else if (headerTheme === "livechat") {
      await StatusBar.setBackgroundColor({ color: readPrimaryBackgroundHexForStatusBar() });
    } else {
      await StatusBar.setBackgroundColor({ color: ANDROID_DARK_STATUS_BG });
    }
  }
}

/**
 * Status bar native: `light` = latar putih + ikon gelap (`Style.Light`); `dark` = latar gelap + ikon terang;
 * `livechat` = seperti `light` secara inset (WebView di bawah status bar; tidak menambah `--safe-area-inset-top`),
 * dengan latar status bar dari `--primary` + `Style.Dark` — hanya modul Live Chat.
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
