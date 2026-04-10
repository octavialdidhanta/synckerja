import { useState, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Only treat the visual viewport as "keyboard open" when it shrinks *substantially*.
 * Android WebView often reports visualViewport.height between ~70–90% of innerHeight with the
 * keyboard **closed**; using 0.75 caused false positives → main used a short `height` + raw
 * `offsetTop` → letterboxing (gaps top + bottom on every page).
 */
const KEYBOARD_VIEWPORT_MAX_HEIGHT_RATIO = 0.65;

/**
 * Android WebView: when not keyboard, offsetTop must be 0 for shells (header uses .safe-area-top).
 */
function normalizeVisualViewportOffsetTop(height: number, offsetTop: number): number {
  if (typeof window === 'undefined') return offsetTop;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return offsetTop;
  if (height >= window.innerHeight * KEYBOARD_VIEWPORT_MAX_HEIGHT_RATIO) return 0;
  return offsetTop;
}

function isVisualKeyboardOpen(height: number): boolean {
  if (typeof window === 'undefined') return false;
  const innerH = window.innerHeight;
  return height > 0 && height < innerH * KEYBOARD_VIEWPORT_MAX_HEIGHT_RATIO;
}

function computeMainFixedStyle(height: number, offsetTop: number): CSSProperties {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0 };
  }

  const keyboardOpen = isVisualKeyboardOpen(height);

  // Android: full bleed when keyboard closed — never use a shortened vv.height or stray offsetTop
  // (primary fix for "app shrunk" / gaps above bottom nav).
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    if (!keyboardOpen) {
      return { top: 0, bottom: 0, left: 0, right: 0 };
    }
    return { top: offsetTop, height, left: 0, right: 0 };
  }

  if (keyboardOpen) {
    return { top: offsetTop, height };
  }
  return { top: offsetTop, bottom: 0 };
}

export interface VisualViewportState {
  /** visualViewport.height */
  height: number;
  /** Normalized visualViewport.offsetTop (Android quirk handled). */
  offsetTop: number;
  /**
   * Styles for `fixed` `<main>` shells: when keyboard closed, `top` + `bottom: 0` (avoid vv.height
   * shrink gap on Android); when keyboard open, `top` + `height` from visual viewport.
   */
  mainFixedStyle: CSSProperties;
}

/**
 * Returns visual viewport dimensions and derived `mainFixedStyle` for mobile page shells.
 * On mobile, when the keyboard opens, visualViewport.height shrinks so the
 * chat container can use this height and keep the input bar above the keyboard.
 */
export function useVisualViewport(): VisualViewportState {
  const [viewport, setViewport] = useState(() => {
    if (typeof window === 'undefined') return { height: 0, offsetTop: 0 };
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

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const mainFixedStyle = useMemo(
    () => computeMainFixedStyle(viewport.height, viewport.offsetTop),
    [viewport.height, viewport.offsetTop]
  );

  return { height: viewport.height, offsetTop: viewport.offsetTop, mainFixedStyle };
}
