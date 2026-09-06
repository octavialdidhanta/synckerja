import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const DEFAULT_HOLD_MS = 240;

function freezeStyle(height: number, footerInset: string): CSSProperties {
  return {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: "auto",
    width: "100%",
    height,
    minHeight: height,
    maxHeight: height,
    transition: "none",
    ["--pos-frozen-footer-inset" as string]: footerInset,
  } as CSSProperties;
}

/**
 * Freeze a POS `fixed inset-0` shell at the pre-keyboard height while a drawer
 * is open so the page behind does not shrink/jump with the IME. Hold the freeze
 * through the drawer close animation to avoid a one-frame cover of the tab bar.
 */
export function usePosFrozenBackgroundShell(
  locked: boolean,
  options?: { holdMs?: number },
): CSSProperties | undefined {
  const holdMs = options?.holdMs ?? DEFAULT_HOLD_MS;
  const heightRef = useRef<number | null>(null);
  const insetRef = useRef("0px");
  const wasLockedRef = useRef(false);
  const [held, setHeld] = useState(false);
  const [style, setStyle] = useState<CSSProperties | undefined>();

  useEffect(() => {
    if (locked) {
      wasLockedRef.current = true;
      setHeld(true);
      return;
    }
    if (!wasLockedRef.current) return;
    const timer = window.setTimeout(() => {
      wasLockedRef.current = false;
      heightRef.current = null;
      setHeld(false);
    }, holdMs);
    return () => window.clearTimeout(timer);
  }, [locked, holdMs]);

  const active = locked || held;

  useLayoutEffect(() => {
    if (!active || typeof window === "undefined") {
      setStyle(undefined);
      return;
    }
    if (heightRef.current == null) {
      heightRef.current = window.innerHeight;
      const inset = getComputedStyle(document.documentElement)
        .getPropertyValue("--footer-bottom-inset")
        .trim();
      insetRef.current = inset || "0px";
    }
    setStyle(freezeStyle(heightRef.current, insetRef.current));
  }, [active]);

  return style;
}
