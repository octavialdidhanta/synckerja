import { useEffect, useRef, useState } from "react";

const DEFAULT_HIDE_DEBOUNCE_MS = 200;

/**
 * Page overlay skeleton: debounce + rAF on first reveal, then ignore later `rawPending`
 * spikes (tab focus refetch, filter change with keepPreviousData, etc.).
 * Mirrors {@link HomePageLoadContext} `hasRevealedContentRef` behavior.
 */
export function useStickyPageSkeletonGate(
  rawPending: boolean,
  hideDebounceMs = DEFAULT_HIDE_DEBOUNCE_MS,
): boolean {
  const [revealed, setRevealed] = useState(false);
  const hasRevealedRef = useRef(false);

  useEffect(() => {
    if (rawPending) {
      if (!hasRevealedRef.current) {
        setRevealed(false);
      }
      return;
    }
    let rafId = 0;
    const t = window.setTimeout(() => {
      rafId = requestAnimationFrame(() => {
        setRevealed(true);
        hasRevealedRef.current = true;
      });
    }, hideDebounceMs);
    return () => {
      window.clearTimeout(t);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [rawPending, hideDebounceMs]);

  if (hasRevealedRef.current) {
    return false;
  }
  return rawPending || !revealed;
}
