import { useEffect, useState, type CSSProperties } from "react";

/**
 * Pin a bottom sheet to the visual viewport so it tracks the IME animation.
 *
 * On Android edge-to-edge (`setDecorFitsSystemWindows(false)`), `adjustResize` often
 * does not shrink `window.innerHeight` while `visualViewport` does. Vaul's
 * `repositionInputs` (or applying Capacitor `keyboardWillShow` height immediately)
 * lifts the sheet before the keyboard finishes — leaving a dark gap.
 *
 * Listening to `visualViewport` resize/scroll updates `bottom` frame-by-frame with
 * the keyboard. When the WebView truly resizes, inset ≈ 0 and the sheet stays at
 * `bottom: 0` of the shrunk layout (also correct).
 */
export function useDrawerVisualViewportPin(enabled: boolean): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

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

    let raf = 0;
    const sync = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        // Ignore sub-pixel / nav jitter; real IME is usually ≫ 8px.
        const bottom = inset >= 8 ? inset : 0;
        const maxHeight = Math.max(160, Math.round(vv.height));
        setStyle({
          bottom,
          maxHeight,
          // Never transition `bottom` — that recreates the “jump ahead” feel.
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
