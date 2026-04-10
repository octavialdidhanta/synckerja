import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { useSafeAreaInsets } from "@/mobile/contexts/SafeAreaInsetsContext";

/** Z-index maksimum praktis (di atas modal z-50 / z-[60] / z-[9999]). */
const STRIP_Z_INDEX = 2147483646;

/**
 * Pita hitam di area navigasi sistem Android (di atas tombol back/home/recent).
 * Portal ke document.body + z-index inline agar pasti di atas stacking context lain.
 */
export function AndroidSystemNavBarStrip({ keyboardOpen }: { keyboardOpen: boolean }) {
  const { bottom } = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!Capacitor.isNativePlatform() || !mounted || keyboardOpen) {
    return null;
  }

  const isAndroid = Capacitor.getPlatform() === "android";
  const insetPx = Math.max(0, bottom);
  /** Hanya bila context belum punya inset (sangat awal); biasanya SafeAreaInsetsContext sudah isi fallback. */
  const fallbackNavPx = isAndroid && insetPx === 0 ? 28 : 0;

  /* Android: jangan gabung env(safe-area-inset-bottom) — di WebView sering ≥ inset WindowInsets dan membuat pita lebih tebal dari bar sistem nyata. */
  const height = isAndroid
    ? `${insetPx > 0 ? insetPx : fallbackNavPx}px`
    : `max(${insetPx}px, env(safe-area-inset-bottom, 0px), ${fallbackNavPx}px)`;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 bottom-0 w-full bg-black"
      style={{ height, zIndex: STRIP_Z_INDEX }}
    />,
    document.body
  );
}
