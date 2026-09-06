import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCapacitorKeyboardInset } from "@/shared/native/useCapacitorKeyboardInset";

/**
 * Stable closed pad. Do not swap a large nav inset → 0 when IME opens (content jumps).
 * Drawers with `aboveAppNav={false}` sit above the keyboard via adjustResize — 0.75rem is enough.
 */
const FOOTER_PAD = "0.75rem";

/** Home-indicator / nav-scrim clearance while IME is closed (Android edge-to-edge often has env()=0). */
const FOOTER_SAFE_CLOSED = `max(1rem, calc(${FOOTER_PAD} + env(safe-area-inset-bottom, 0px)), calc(${FOOTER_PAD} + var(--safe-area-inset-bottom, 0px)), calc(${FOOTER_PAD} + var(--footer-bottom-inset, 0px)))`;

/** Absolute drop in `window.innerHeight` that signals adjustResize keyboard. */
const HEIGHT_DROP_PX = 120;
/** Relative drop vs baseline (covers short phones). */
const HEIGHT_DROP_RATIO = 0.15;
/** Treat viewport as "recovered" (keyboard closed) within this of baseline. */
const VIEWPORT_RECOVER_PX = 40;

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

function logKb(event: string, data: Record<string, unknown>) {
  // Capacitor/Console only surfaces the *last* console argument — keep one string.
  console.info(`pos-kb ${event} ${JSON.stringify(data)}`);
}

/**
 * Phone bottom-sheet chrome for Android `adjustResize`.
 *
 * Jump sources we deliberately avoid:
 * 1. React `maxHeight: viewportH` updates during resize (lag → hentakan)
 * 2. CSS `dvh` max-height (dynamic viewport changes when IME opens)
 * 3. Collapsing large `--footer-bottom-inset` pad when IME opens
 *
 * Sheet stays `fixed; bottom: 0` with `max-h-[90%]` so the browser layout tracks
 * the WebView resize in the same frame as the OS — no JS height animation.
 */
export function usePhoneDrawerKeyboardChrome() {
  const { keyboardOpenNative, keyboardHeightPx } = useCapacitorKeyboardInset();
  const [viewportH, setViewportH] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );
  const [textFieldFocused, setTextFieldFocused] = useState(false);
  const [stickyOpen, setStickyOpen] = useState(false);
  const baselineRef = useRef(typeof window === "undefined" ? 0 : window.innerHeight);
  const stickyOpenRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncSticky = (h: number, focused: boolean) => {
      const baseline = baselineRef.current || h;
      const drop = Math.max(0, baseline - h);
      const compressed =
        focused &&
        baseline > 0 &&
        (drop >= HEIGHT_DROP_PX || drop / baseline >= HEIGHT_DROP_RATIO);
      if (compressed) {
        if (!stickyOpenRef.current) {
          logKb("layout_compressed", {
            h,
            baseline,
            drop,
            keyboardOpenNative,
            keyboardHeightPx,
          });
        }
        stickyOpenRef.current = true;
        setStickyOpen(true);
        return;
      }
      if (baseline > 0 && h >= baseline - VIEWPORT_RECOVER_PX) {
        if (stickyOpenRef.current) {
          logKb("layout_recovered", { h, baseline });
        }
        stickyOpenRef.current = false;
        setStickyOpen(false);
      }
    };

    const syncHeight = () => {
      const h = window.innerHeight;
      const vv = window.visualViewport;
      setViewportH(h);
      if (!isTextField(document.activeElement) && !stickyOpenRef.current) {
        baselineRef.current = h;
      }
      syncSticky(h, isTextField(document.activeElement));
      if (isTextField(document.activeElement) || stickyOpenRef.current) {
        logKb("resize", {
          inner: h,
          vvH: vv ? Math.round(vv.height) : null,
          vvTop: vv ? Math.round(vv.offsetTop) : null,
          baseline: baselineRef.current,
          native: keyboardOpenNative,
          kbH: keyboardHeightPx,
        });
      }
    };

    const syncFocus = () => {
      requestAnimationFrame(() => {
        const focused = isTextField(document.activeElement);
        const el = document.activeElement;
        setTextFieldFocused(focused);
        logKb("focus", {
          focused,
          tag: el instanceof HTMLElement ? el.tagName : null,
          type: el instanceof HTMLInputElement ? el.type : null,
          inner: window.innerHeight,
          baseline: baselineRef.current,
          sticky: stickyOpenRef.current,
          native: keyboardOpenNative,
          scrollY: window.scrollY,
          vvTop: window.visualViewport
            ? Math.round(window.visualViewport.offsetTop)
            : null,
        });
        // Undo WebView "scroll focused field into view" pan that runs *before* IME
        // (classic jump-then-keyboard). adjustResize will reflow the sheet.
        if (focused) {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }
        if (!focused && !stickyOpenRef.current) {
          baselineRef.current = window.innerHeight;
          setViewportH(window.innerHeight);
        }
        syncSticky(window.innerHeight, focused);
      });
    };

    const syncVvScroll = () => {
      const vv = window.visualViewport;
      if (!vv || !isTextField(document.activeElement)) return;
      if (vv.offsetTop > 0 || window.scrollY > 0) {
        logKb("vv_scroll_reset", {
          offsetTop: Math.round(vv.offsetTop),
          scrollY: window.scrollY,
          inner: window.innerHeight,
          vvH: Math.round(vv.height),
        });
        window.scrollTo(0, 0);
      }
    };

    syncHeight();
    syncFocus();
    window.addEventListener("resize", syncHeight);
    window.visualViewport?.addEventListener("resize", syncHeight);
    window.visualViewport?.addEventListener("scroll", syncVvScroll);
    document.addEventListener("focusin", syncFocus);
    document.addEventListener("focusout", syncFocus);
    return () => {
      window.removeEventListener("resize", syncHeight);
      window.visualViewport?.removeEventListener("resize", syncHeight);
      window.visualViewport?.removeEventListener("scroll", syncVvScroll);
      document.removeEventListener("focusin", syncFocus);
      document.removeEventListener("focusout", syncFocus);
    };
  }, [keyboardOpenNative, keyboardHeightPx]);

  const baseline = baselineRef.current || viewportH;
  const heightDrop = Math.max(0, baseline - viewportH);
  const heightCompressed =
    textFieldFocused &&
    baseline > 0 &&
    (heightDrop >= HEIGHT_DROP_PX || heightDrop / baseline >= HEIGHT_DROP_RATIO);

  const keyboardOpen =
    heightCompressed || stickyOpen || (keyboardOpenNative && heightDrop >= HEIGHT_DROP_PX);

  /** `%` of layout viewport — tracks adjustResize without React; never use `dvh`. */
  const drawerClassName =
    "z-[90] flex max-h-[90%] flex-col gap-0 overflow-hidden p-0";

  /** No inline maxHeight — JS updates during IME were the jump. */
  const drawerMaxHeightStyle: CSSProperties | undefined = undefined;

  return {
    keyboardOpen,
    drawerClassName,
    bodyClassName: "min-h-0 flex-1 space-y-3 overflow-y-auto p-4",
    listBodyClassName: "scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto p-4",
    headerStyle: undefined,
    footerStyle: {
      // Closed: plugin inset (--footer-bottom-inset) — env() alone is often 0 on edge-to-edge Android.
      // Open: keep FOOTER_PAD only so inset collapse does not jerk the Confirm row.
      paddingBottom: keyboardOpen ? FOOTER_PAD : FOOTER_SAFE_CLOSED,
    } as const,
    drawerMaxHeightStyle,
  };
}
