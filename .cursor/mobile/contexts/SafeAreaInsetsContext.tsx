import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface SafeAreaInsets {
  top: number;
  bottom: number;
}

const defaultInsets: SafeAreaInsets = { top: 0, bottom: 0 };

const SafeAreaInsetsContext = createContext<SafeAreaInsets>(defaultInsets);

export function useSafeAreaInsets(): SafeAreaInsets {
  return useContext(SafeAreaInsetsContext);
}

interface SafeAreaInsetsProviderProps {
  children: React.ReactNode;
}

interface SafeAreaInsetsPlugin {
  getInsets(): Promise<{ top: number; bottom: number }>;
}

/**
 * Fallback when platform reports 0,0 (e.g. some emulators or timing).
 * Android plugin returns dp-aligned values (physical px ÷ density) so these match CSS px.
 */
const NATIVE_FALLBACK_INSETS: SafeAreaInsets = { top: 28, bottom: 28 };

/**
 * Android often reports status-bar top = 0 while bottom (nav / gesture bar) > 0.
 * Using raw values then leaves --safe-area-inset-top at 0 and headers sit under the status bar.
 *
 * When WindowInsets report full values, --safe-area-inset-top can jump vs the old fallback-only path.
 * On Android, cap top to the same ceiling as NATIVE_FALLBACK.
 *
 * Bottom inset must stay on the CSS vars so footers, drawers, and modal-above-safe-area end above the
 * system nav strip (layout), while index.css android rules use var-only (no env) to avoid doubling.
 * When the plugin reports 0 for bottom, use NATIVE_FALLBACK_INSETS.bottom so layout matches the strip.
 */
function normalizeNativeInsets(raw: SafeAreaInsets): SafeAreaInsets {
  const isAndroid = Capacitor.getPlatform() === "android";
  let bottom = Math.max(0, raw.bottom ?? 0);
  let top = Math.max(0, raw.top ?? 0);

  if (isAndroid && top === 0) {
    top = NATIVE_FALLBACK_INSETS.top;
  }

  if (top === 0 && bottom === 0) {
    return { ...NATIVE_FALLBACK_INSETS };
  }

  if (isAndroid) {
    top = Math.min(top, NATIVE_FALLBACK_INSETS.top);
    if (bottom === 0) {
      bottom = NATIVE_FALLBACK_INSETS.bottom;
    } else {
      bottom = Math.min(bottom, 48);
    }
  }

  return { top, bottom };
}

/**
 * Provides safe area insets from the platform (Android WindowInsets API).
 * On native, if the system reports 0,0 after retries, uses a fallback so content is not covered.
 * On web/non-native, provides { top: 0, bottom: 0 }.
 */
export function SafeAreaInsetsProvider({ children }: SafeAreaInsetsProviderProps) {
  const [insets, setInsets] = useState<SafeAreaInsets>(defaultInsets);
  const retryCleanupRef = useRef<(() => void) | null>(null);

  const fetchInsets = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const plugin = registerPlugin<SafeAreaInsetsPlugin>("SafeAreaInsets");
    const tryFetch = async (): Promise<SafeAreaInsets> => {
      try {
        const result = await plugin.getInsets();
        return { top: result?.top ?? 0, bottom: result?.bottom ?? 0 };
      } catch {
        return defaultInsets;
      }
    };
    const first = await tryFetch();
    setInsets(normalizeNativeInsets(first));
    if (first.top === 0 && first.bottom === 0) {
      const t1 = window.setTimeout(async () => {
        const retry = await tryFetch();
        if (retry.top > 0 || retry.bottom > 0) setInsets(normalizeNativeInsets(retry));
      }, 300);
      const t2 = window.setTimeout(async () => {
        const retry = await tryFetch();
        if (retry.top > 0 || retry.bottom > 0) setInsets(normalizeNativeInsets(retry));
      }, 800);
      const t3 = window.setTimeout(async () => {
        const retry = await tryFetch();
        if (retry.top > 0 || retry.bottom > 0) setInsets(normalizeNativeInsets(retry));
      }, 1500);
      retryCleanupRef.current = () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
      };
    }
  }, []);

  useEffect(() => {
    fetchInsets();
    return () => retryCleanupRef.current?.();
  }, [fetchInsets]);

  return (
    <SafeAreaInsetsContext.Provider value={insets}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}
