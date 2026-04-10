import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

const GAP_ABOVE_KEYBOARD = 12;
/** Heuristic: visual viewport noticeably shorter than layout viewport (software keyboard). */
const VIEWPORT_COMPRESSION_RATIO = 0.82;

export type UseMobileKeyboardViewportOptions = {
  /** When set, scroll panel so this element stays above keyboard gap. */
  submitAnchorRef?: React.RefObject<HTMLButtonElement | null>;
};

export function useMobileKeyboardViewport(options: UseMobileKeyboardViewportOptions = {}) {
  const { submitAnchorRef: submitAnchorRefOption } = options;
  const internalSubmitRef = useRef<HTMLButtonElement | null>(null);
  const submitAnchorRef = submitAnchorRefOption ?? internalSubmitRef;

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewportCompressed, setViewportCompressed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputFocusedRef = useRef(false);

  const scrollPanelToAnchor = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const panel = panelRef.current;
    const btn = submitAnchorRef.current;
    if (!panel || !inputFocusedRef.current) return;

    const vv = window.visualViewport;
    const visibleHeight = vv ? vv.height : window.innerHeight;
    const targetBottom = visibleHeight - GAP_ABOVE_KEYBOARD;

    if (btn) {
      const btnRect = btn.getBoundingClientRect();
      const scrollDelta = btnRect.bottom - targetBottom;
      if (scrollDelta > 0) {
        panel.scrollTop = Math.max(0, panel.scrollTop + scrollDelta);
      }
      return;
    }

    const el = document.activeElement;
    if (el instanceof HTMLElement && panel.contains(el)) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [submitAnchorRef]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const syncCompression = () => {
      const inner = window.innerHeight || 1;
      const compressed = vv.height / inner < VIEWPORT_COMPRESSION_RATIO;
      setViewportCompressed(compressed);
    };

    const onResize = () => {
      syncCompression();
      if (inputFocusedRef.current) scrollPanelToAnchor();
    };

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    syncCompression();
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, [scrollPanelToAnchor]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const showHandler = (info: { keyboardHeight: number }) => {
      setKeyboardHeight(info.keyboardHeight ?? 0);
      if (inputFocusedRef.current) {
        setTimeout(scrollPanelToAnchor, 100);
        setTimeout(scrollPanelToAnchor, 400);
      }
    };
    const hideHandler = () => setKeyboardHeight(0);
    const showPromise = Keyboard.addListener("keyboardWillShow", showHandler);
    const hidePromise = Keyboard.addListener("keyboardWillHide", hideHandler);
    return () => {
      showPromise.then((h) => h.remove());
      hidePromise.then((h) => h.remove());
    };
  }, [scrollPanelToAnchor]);

  /** Native WebView already shrinks with keyboard (e.g. Android adjustResize); extra padding duplicates inset. */
  const keyboardPaddingBottom = 0;

  const keyboardOpen = keyboardHeight > 0 || viewportCompressed;

  const onInputFocus = useCallback(() => {
    inputFocusedRef.current = true;
    setTimeout(scrollPanelToAnchor, 150);
    setTimeout(scrollPanelToAnchor, 450);
    setTimeout(scrollPanelToAnchor, 800);
  }, [scrollPanelToAnchor]);

  const onInputBlur = useCallback(() => {
    inputFocusedRef.current = false;
  }, []);

  return {
    panelRef,
    submitAnchorRef,
    keyboardPaddingBottom,
    keyboardOpen,
    scrollPanelToAnchor,
    onInputFocus,
    onInputBlur,
    inputFocusedRef,
  };
}
