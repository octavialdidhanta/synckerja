import { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { triggerMobileLayoutReflow } from "@/shared/mobile/triggerMobileLayoutReflow";

/** Android WebView: treat keyboard only when viewport shrinks substantially. */
const KEYBOARD_VIEWPORT_MAX_HEIGHT_RATIO = 0.65;

function normalizeVisualViewportOffsetTop(height: number, offsetTop: number): number {
  if (typeof window === "undefined") return offsetTop;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return offsetTop;
  if (height >= window.innerHeight * KEYBOARD_VIEWPORT_MAX_HEIGHT_RATIO) return 0;
  return offsetTop;
}

function isVisualKeyboardOpen(height: number): boolean {
  if (typeof window === "undefined") return false;
  const innerH = window.innerHeight;
  return height > 0 && height < innerH * KEYBOARD_VIEWPORT_MAX_HEIGHT_RATIO;
}

/**
 * Selaras `synckerja-reference` `useVisualViewport.ts` — hanya `visualViewport`, tanpa plugin keyboard /
 * infer pasca-resume (sumber umum double inset + strip abu).
 */
function computeMainFixedStyle(height: number, offsetTop: number): CSSProperties {
  if (typeof window === "undefined") {
    return { top: 0, bottom: 0, left: 0, right: 0, width: "100%" };
  }

  const keyboardOpen = isVisualKeyboardOpen(height);
  /** Without left/right (or explicit width), `fixed` can collapse → narrow/half-width shell. */
  const fullBleed: CSSProperties = { left: 0, right: 0, width: "100%" };

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    if (!keyboardOpen) {
      return { top: 0, bottom: 0, ...fullBleed };
    }
    return { top: offsetTop, height, ...fullBleed };
  }

  if (keyboardOpen) {
    return { top: offsetTop, height, ...fullBleed };
  }
  return { top: offsetTop, bottom: 0, ...fullBleed };
}

export interface VisualViewportState {
  height: number;
  offsetTop: number;
  mainFixedStyle: CSSProperties;
  /** Sama heuristik keyboard shell: vv jelas menyusut (bukan plugin). */
  isKeyboardShellOpen: boolean;
}

/** Visual viewport + `mainFixedStyle` for fixed mobile shells (synckerja-reference parity). */
export function useVisualViewport(): VisualViewportState {
  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") return { height: 0, offsetTop: 0 };
    const vv = window.visualViewport;
    const innerH = window.innerHeight;
    const height = vv?.height ?? innerH;
    const rawTop = vv?.offsetTop ?? 0;
    const offsetTop = normalizeVisualViewportOffsetTop(height, rawTop);
    return { height, offsetTop };
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const height = vv.height;
      const offsetTop = normalizeVisualViewportOffsetTop(height, vv.offsetTop);
      setViewport({ height, offsetTop });
    };

    const nudgeAfterForeground = () => {
      update();
      if (Capacitor.isNativePlatform()) {
        triggerMobileLayoutReflow();
      }
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    const onVisibility = () => {
      if (document.visibilityState === "visible") nudgeAfterForeground();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let removeResume: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void App.addListener("resume", nudgeAfterForeground).then((handle) => {
        removeResume = () => void handle.remove();
      });
    }

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("visibilitychange", onVisibility);
      removeResume?.();
    };
  }, []);

  const mainFixedStyle = useMemo(
    () => computeMainFixedStyle(viewport.height, viewport.offsetTop),
    [viewport.height, viewport.offsetTop],
  );

  const isKeyboardShellOpen = useMemo(() => {
    const liveHeight =
      typeof window !== "undefined" && window.visualViewport
        ? window.visualViewport.height
        : viewport.height;
    return isVisualKeyboardOpen(liveHeight);
  }, [viewport.height]);

  return {
    height: viewport.height,
    offsetTop: viewport.offsetTop,
    mainFixedStyle,
    isKeyboardShellOpen,
  };
}
