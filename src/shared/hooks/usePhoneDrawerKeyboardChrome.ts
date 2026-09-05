import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCapacitorKeyboardInset } from "@/shared/native/useCapacitorKeyboardInset";

const FOOTER_PAD_CLOSED =
  "max(1rem, calc(var(--footer-bottom-inset, 0px) + 0.75rem), calc(env(safe-area-inset-bottom, 0px) + 0.75rem))";

/** Absolute drop in `window.innerHeight` that signals adjustResize keyboard. */
const HEIGHT_DROP_PX = 120;
/** Relative drop vs baseline (covers short phones). */
const HEIGHT_DROP_RATIO = 0.15;

function isTextField(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || "text").toLowerCase();
    return !["button", "checkbox", "radio", "submit", "reset", "file", "hidden", "range", "color"].includes(
      type,
    );
  }
  return el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable;
}

/**
 * Phone bottom-sheet chrome: drop nav safe-area bottom pad while the keyboard is open
 * (Android adjustResize already shrinks the WebView — extra inset creates a gap).
 *
 * Do not add safe-area top padding on the blue header when the keyboard opens — the sheet
 * sits mid-viewport above the keyboard, so status-bar inset only inflates the title bar.
 *
 * Detection: Capacitor keyboard plugin OR (focused text field + innerHeight drop vs baseline).
 * visualViewport compression alone is unreliable under adjustResize (vv and inner shrink together).
 *
 * Bottom pinning / IME tracking lives in {@link useDrawerVisualViewportPin} (DrawerContent).
 * Do not also apply Capacitor `keyboardWillShow` height here — that jumps the sheet early.
 */
export function usePhoneDrawerKeyboardChrome() {
  const { keyboardOpenNative } = useCapacitorKeyboardInset();
  const [viewportH, setViewportH] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );
  const [textFieldFocused, setTextFieldFocused] = useState(false);
  const baselineRef = useRef(typeof window === "undefined" ? 0 : window.innerHeight);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncHeight = () => {
      const h = window.innerHeight;
      setViewportH(h);
      if (!isTextField(document.activeElement)) {
        baselineRef.current = h;
      }
    };

    const syncFocus = () => {
      // Defer so focusout→focusin between fields does not briefly clear focus
      // and rewrite baseline to the keyboard-shrunk height.
      requestAnimationFrame(() => {
        const focused = isTextField(document.activeElement);
        setTextFieldFocused(focused);
        if (!focused) {
          baselineRef.current = window.innerHeight;
          setViewportH(window.innerHeight);
        }
      });
    };

    syncHeight();
    syncFocus();
    window.addEventListener("resize", syncHeight);
    window.visualViewport?.addEventListener("resize", syncHeight);
    document.addEventListener("focusin", syncFocus);
    document.addEventListener("focusout", syncFocus);
    return () => {
      window.removeEventListener("resize", syncHeight);
      window.visualViewport?.removeEventListener("resize", syncHeight);
      document.removeEventListener("focusin", syncFocus);
      document.removeEventListener("focusout", syncFocus);
    };
  }, []);

  const baseline = baselineRef.current || viewportH;
  const heightDrop = Math.max(0, baseline - viewportH);
  const heightCompressed =
    textFieldFocused &&
    baseline > 0 &&
    (heightDrop >= HEIGHT_DROP_PX || heightDrop / baseline >= HEIGHT_DROP_RATIO);

  const keyboardOpen = keyboardOpenNative || heightCompressed;

  const drawerMaxHeightStyle: CSSProperties | undefined =
    viewportH > 0 ? { maxHeight: viewportH } : undefined;

  return {
    keyboardOpen,
    drawerClassName: keyboardOpen
      ? "z-[90] flex max-h-full flex-col gap-0 overflow-hidden p-0"
      : "z-[90] flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0",
    /** Short forms: avoid flex-1 void between fields and footer while keyboard is open. */
    bodyClassName: keyboardOpen
      ? "min-h-0 flex-none space-y-3 overflow-y-auto p-4"
      : "min-h-0 flex-1 space-y-3 overflow-y-auto p-4",
    /** Scrollable lists keep flex-1 so the footer stays docked. */
    listBodyClassName: "scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto p-4",
    /** Keep title bar `py-3` only — never inject safe-area top on keyboard open. */
    headerStyle: undefined,
    footerStyle: {
      paddingBottom: keyboardOpen ? "0.75rem" : FOOTER_PAD_CLOSED,
    } as const,
    drawerMaxHeightStyle,
  };
}
