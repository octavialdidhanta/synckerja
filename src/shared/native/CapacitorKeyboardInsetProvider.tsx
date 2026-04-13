/* Context module: Provider + consumer hook (react-refresh expects components-only files). */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";

export type CapacitorKeyboardInset = {
  keyboardOpenNative: boolean;
  keyboardHeightPx: number;
};

const CapacitorKeyboardInsetContext = createContext<CapacitorKeyboardInset | null>(null);

const FALLBACK_INSET: CapacitorKeyboardInset = {
  keyboardOpenNative: false,
  keyboardHeightPx: 0,
};

/**
 * Hanya mirror @capacitor/keyboard + reset ringan saat resume — **tanpa** infer `visualViewport`
 * (referensi: synckerja-reference tidak menggabungkan plugin + vv; infer sering bikin padding palsu).
 */
export function CapacitorKeyboardInsetProvider({ children }: { children: ReactNode }) {
  const [keyboardOpenNative, setOpen] = useState(false);
  const [keyboardHeightPx, setHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    const reset = () => {
      setOpen(false);
      setHeight(0);
    };

    const onShow = (info: { keyboardHeight?: number }) => {
      setHeight(info.keyboardHeight ?? 0);
      setOpen(true);
    };

    const showWillPromise = Keyboard.addListener("keyboardWillShow", onShow);
    const showDidPromise = Keyboard.addListener("keyboardDidShow", onShow);
    const hideWillPromise = Keyboard.addListener("keyboardWillHide", reset);
    const hideDidPromise = Keyboard.addListener("keyboardDidHide", reset);

    let removeResume: (() => void) | undefined;
    const onAppResume = () => {
      reset();
    };
    void App.addListener("resume", onAppResume).then((handle) => {
      removeResume = () => void handle.remove();
    });

    return () => {
      reset();
      void showWillPromise.then((h) => h.remove());
      void showDidPromise.then((h) => h.remove());
      void hideWillPromise.then((h) => h.remove());
      void hideDidPromise.then((h) => h.remove());
      removeResume?.();
    };
  }, []);

  const value = useMemo<CapacitorKeyboardInset>(() => {
    const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
    return {
      keyboardOpenNative: isAndroidNative && keyboardOpenNative,
      keyboardHeightPx: isAndroidNative ? keyboardHeightPx : 0,
    };
  }, [keyboardOpenNative, keyboardHeightPx]);

  return (
    <CapacitorKeyboardInsetContext.Provider value={value}>{children}</CapacitorKeyboardInsetContext.Provider>
  );
}

/**
 * Membaca inset keyboard dari {@link CapacitorKeyboardInsetProvider}.
 * Tanpa provider: mengembalikan no-op (dan peringatan dev) agar test/Storybook tidak crash.
 */
export function useCapacitorKeyboardInset(): CapacitorKeyboardInset {
  const ctx = useContext(CapacitorKeyboardInsetContext);
  if (ctx) return ctx;
  if (import.meta.env.DEV) {
    console.warn(
      "[synckerja] useCapacitorKeyboardInset used outside CapacitorKeyboardInsetProvider; keyboard inset will be stale on native.",
    );
  }
  return FALLBACK_INSET;
}
