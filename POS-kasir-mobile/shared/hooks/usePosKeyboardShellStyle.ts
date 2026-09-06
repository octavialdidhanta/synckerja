import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCapacitorKeyboardInset } from "@/shared/native/useCapacitorKeyboardInset";

/** Ignore sub-pixel / nav jitter; real IME is usually ≫ 8px. */
const VV_INSET_MIN_PX = 8;
/** Layout viewport drop that means Android adjustResize already shrunk the WebView. */
const LAYOUT_SHRINK_PX = 80;

function readVisualViewport(): {
  inset: number;
  height: number;
  offsetTop: number;
  inner: number;
} {
  if (typeof window === "undefined") {
    return { inset: 0, height: 0, offsetTop: 0, inner: 0 };
  }
  const vv = window.visualViewport;
  const inner = window.innerHeight;
  if (!vv) {
    return { inset: 0, height: inner, offsetTop: 0, inner };
  }
  const inset = Math.max(0, Math.round(inner - vv.height - vv.offsetTop));
  return {
    inset: inset >= VV_INSET_MIN_PX ? inset : 0,
    height: Math.round(vv.height),
    offsetTop: Math.round(vv.offsetTop),
    inner,
  };
}

/**
 * Pin POS `fixed` / `100dvh` shells to the visible viewport while the IME is open.
 *
 * Only when the layout viewport did **not** shrink (broken edge-to-edge adjustResize).
 * If adjustResize already shrunk `innerHeight`, applying a fixed vv pin causes a
 * visible upward jerk — skip the style and rely on `html[data-keyboard-open]` CSS
 * to drop footer safe-area padding.
 */
export function usePosKeyboardShellStyle(options?: {
  enabled?: boolean;
}): CSSProperties | undefined {
  const enabled = options?.enabled !== false;
  const { keyboardOpenNative } = useCapacitorKeyboardInset();
  const [vv, setVv] = useState(readVisualViewport);
  const baselineInnerRef = useRef(
    typeof window === "undefined" ? 0 : window.innerHeight,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    baselineInnerRef.current = window.innerHeight;
    const sync = () => {
      const next = readVisualViewport();
      // Never let adjustResize mid-animation rewrite the open baseline (that
      // kept layoutShrunk false and let a late vv pin fire → upward jerk).
      const baseline = baselineInnerRef.current || next.inner;
      const shrinking = baseline - next.inner >= LAYOUT_SHRINK_PX;
      if (next.inset < VV_INSET_MIN_PX && !shrinking && next.inner >= baseline - 24) {
        baselineInnerRef.current = next.inner;
      } else if (next.inner > baseline) {
        baselineInnerRef.current = next.inner;
      }
      setVv(next);
    };
    sync();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const layoutShrunk = baselineInnerRef.current - vv.inner >= LAYOUT_SHRINK_PX;
  const keyboardOpen = keyboardOpenNative || vv.inset > 0 || layoutShrunk;

  // adjustResize path — no sudden fixed/height swap (that is the global jerk).
  // Also skip when WebView only panned (offsetTop) without a real inset gap.
  // Skip while a drawer has frozen the page behind the IME.
  if (
    !enabled ||
    !keyboardOpen ||
    layoutShrunk ||
    vv.inset === 0 ||
    vv.offsetTop > 0
  ) {
    return undefined;
  }

  return {
    position: "fixed",
    top: vv.offsetTop,
    height: vv.height,
    bottom: "auto",
    left: 0,
    right: 0,
    width: "100%",
    maxHeight: vv.height,
    transition: "none",
  };
}

/**
 * Mirrors keyboard-open onto `html[data-keyboard-open]` so global CSS can drop
 * footer safe-area / `--footer-bottom-inset` while typing.
 *
 * Prefer settled signals (keyboardDidShow / vv inset) so we do not strip padding
 * a frame before the WebView resizes — that early pad collapse also feels like a jerk.
 */
export function PosKeyboardOpenDocumentAttrSync() {
  const { keyboardOpenNative } = useCapacitorKeyboardInset();
  const [vvOpen, setVvOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const baselineInnerRef = useRef(
    typeof window === "undefined" ? 0 : window.innerHeight,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    baselineInnerRef.current = window.innerHeight;
    const sync = () => {
      const next = readVisualViewport();
      if (next.inset < VV_INSET_MIN_PX && next.inner >= baselineInnerRef.current - 24) {
        baselineInnerRef.current = next.inner;
      }
      setVvOpen(next.inset > 0);
      setLayoutOpen(baselineInnerRef.current - next.inner >= LAYOUT_SHRINK_PX);
    };
    sync();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const open = keyboardOpenNative || vvOpen || layoutOpen;

  useEffect(() => {
    const root = document.documentElement;
    if (open) root.setAttribute("data-keyboard-open", "");
    else root.removeAttribute("data-keyboard-open");
    return () => root.removeAttribute("data-keyboard-open");
  }, [open]);

  return null;
}
