import { useEffect, useRef, useState, type CSSProperties } from "react";

/** Ignore sub-pixel / nav jitter; real IME is usually ≫ 8px. */
const VV_INSET_MIN_PX = 8;
/** Layout viewport drop that means Android adjustResize is already shrinking the WebView. */
const LAYOUT_SHRINK_PX = 80;

/**
 * Pin a bottom sheet to the visual viewport so it tracks the IME animation.
 *
 * On Android edge-to-edge (`setDecorFitsSystemWindows(false)`), `adjustResize` often
 * does not shrink `window.innerHeight` while `visualViewport` does — then we pin
 * `bottom` to the vv inset frame-by-frame.
 *
 * When adjustResize *does* shrink the layout viewport, pinning on top of that
 * double-lifts the sheet (the “hentakan ke atas”). Skip the pin in that case and
 * leave the sheet at `bottom: 0` of the already-shrunk WebView.
 */
export function useDrawerVisualViewportPin(enabled: boolean): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});
  const baselineInnerRef = useRef(
    typeof window === "undefined" ? 0 : window.innerHeight,
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setStyle({});
      return;
    }

    const vv = window.visualViewport;
    if (!vv) {
      setStyle({});
      return;
    }

    baselineInnerRef.current = window.innerHeight;

    let raf = 0;
    const sync = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const inner = window.innerHeight;
        const inset = Math.max(0, Math.round(inner - vv.height - vv.offsetTop));
        const layoutShrunk = baselineInnerRef.current - inner >= LAYOUT_SHRINK_PX;

        if (!layoutShrunk && inset < VV_INSET_MIN_PX) {
          // Idle / keyboard closed — refresh baseline for the next open.
          baselineInnerRef.current = inner;
        }

        // adjustResize already moved the sheet with the WebView — do not also pin.
        if (layoutShrunk || inset < VV_INSET_MIN_PX) {
          setStyle({});
          return;
        }

        setStyle({
          bottom: inset,
          maxHeight: Math.max(160, Math.round(vv.height)),
          transition: "none",
        });
      });
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      window.cancelAnimationFrame(raf);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [enabled]);

  return style;
}
