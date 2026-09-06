import { useCallback, useEffect, useRef, useState } from "react";
import { useCapacitorKeyboardInset } from "@/shared/native/useCapacitorKeyboardInset";
import { POS_APP_FOOTER_OVERLAY_BOTTOM_CLASS } from "@/pos-mobile/shared/layout/PosAppFooterBar";

/** Absolute drop in `window.innerHeight` that signals adjustResize keyboard. */
const HEIGHT_DROP_PX = 120;
/** Relative drop vs baseline (covers short phones). */
const HEIGHT_DROP_RATIO = 0.15;
const GAP_ABOVE_KEYBOARD_PX = 8;

function isTextField(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || "text").toLowerCase();
    return ![
      "button",
      "checkbox",
      "radio",
      "submit",
      "reset",
      "file",
      "hidden",
      "range",
      "color",
    ].includes(type);
  }
  return (
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el.isContentEditable
  );
}

export type UsePosKeyboardDockOptions = {
  /** When false, detection + scroll are idle (e.g. overlay closed). Default true. */
  enabled?: boolean;
  /**
   * Full-bleed overlay that normally sits above the blue app footer.
   * While the keyboard is open, collapses to `bottom-0` so content can sit on the IME
   * (footer gap would otherwise leave empty space above the keyboard).
   */
  footerOverlay?: boolean;
  /**
   * Scroll the focused field into view. Disable inside bottom drawers — focus scroll
   * runs before the IME and makes the sheet jump, then the keyboard appears.
   * Default true.
   */
  scrollIntoView?: boolean;
};

/**
 * POS keyboard docking: detect IME, optionally collapse footer overlay inset,
 * and keep the focused text field visible just above the keyboard.
 */
export function usePosKeyboardDock(options: UsePosKeyboardDockOptions = {}) {
  const { enabled = true, footerOverlay = false, scrollIntoView: scrollIntoViewEnabled = true } =
    options;
  const { keyboardOpenNative } = useCapacitorKeyboardInset();
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );
  const [textFieldFocused, setTextFieldFocused] = useState(false);
  const baselineRef = useRef(typeof window === "undefined" ? 0 : window.innerHeight);

  const scrollFocusedIntoView = useCallback(() => {
    if (!enabled || !scrollIntoViewEnabled || typeof window === "undefined") return;
    const el = document.activeElement;
    if (!isTextField(el) || !(el instanceof HTMLElement)) return;

    const root = scrollRootRef.current;
    if (root && root.contains(el)) {
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const vv = window.visualViewport;
      const visibleBottom = vv
        ? vv.offsetTop + vv.height - GAP_ABOVE_KEYBOARD_PX
        : window.innerHeight - GAP_ABOVE_KEYBOARD_PX;
      const clampBottom = Math.min(rootRect.bottom, visibleBottom);
      if (elRect.bottom > clampBottom) {
        root.scrollTop += elRect.bottom - clampBottom;
      } else if (elRect.top < rootRect.top + GAP_ABOVE_KEYBOARD_PX) {
        root.scrollTop -= rootRect.top + GAP_ABOVE_KEYBOARD_PX - elRect.top;
      }
      return;
    }

    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [enabled, scrollIntoViewEnabled]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const syncHeight = () => {
      const h = window.innerHeight;
      setViewportH(h);
      if (!isTextField(document.activeElement)) {
        baselineRef.current = h;
      }
      if (isTextField(document.activeElement)) {
        scrollFocusedIntoView();
      }
    };

    const syncFocus = () => {
      requestAnimationFrame(() => {
        const focused = isTextField(document.activeElement);
        setTextFieldFocused(focused);
        if (!focused) {
          baselineRef.current = window.innerHeight;
          setViewportH(window.innerHeight);
          return;
        }
        scrollFocusedIntoView();
        window.setTimeout(scrollFocusedIntoView, 150);
        window.setTimeout(scrollFocusedIntoView, 400);
      });
    };

    syncHeight();
    syncFocus();
    window.addEventListener("resize", syncHeight);
    window.visualViewport?.addEventListener("resize", syncHeight);
    window.visualViewport?.addEventListener("scroll", syncHeight);
    document.addEventListener("focusin", syncFocus);
    document.addEventListener("focusout", syncFocus);
    return () => {
      window.removeEventListener("resize", syncHeight);
      window.visualViewport?.removeEventListener("resize", syncHeight);
      window.visualViewport?.removeEventListener("scroll", syncHeight);
      document.removeEventListener("focusin", syncFocus);
      document.removeEventListener("focusout", syncFocus);
    };
  }, [enabled, scrollFocusedIntoView]);

  const baseline = baselineRef.current || viewportH;
  const heightDrop = Math.max(0, baseline - viewportH);
  const heightCompressed =
    textFieldFocused &&
    baseline > 0 &&
    (heightDrop >= HEIGHT_DROP_PX || heightDrop / baseline >= HEIGHT_DROP_RATIO);

  const keyboardOpen = Boolean(
    enabled && (keyboardOpenNative || heightCompressed),
  );

  const overlayBottomClassName = footerOverlay
    ? keyboardOpen
      ? "bottom-0"
      : POS_APP_FOOTER_OVERLAY_BOTTOM_CLASS
    : undefined;

  return {
    keyboardOpen,
    scrollRootRef,
    overlayBottomClassName,
    scrollFocusedIntoView,
  };
}
