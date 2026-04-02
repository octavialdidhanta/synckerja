import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DEFAULT_MS = 200;

/**
 * Delays turning "ready" on so adjacent query settles do not flash the real UI.
 * Always starts not-ready: avoids a one-frame flash when `rawReady` is briefly true
 * before React Query marks the enabled query as pending.
 * When going not-ready, clears synchronously in useLayoutEffect (before paint).
 * Timer callback re-checks latest `rawReady` via ref before committing ready.
 */
export function useDebouncedReady(rawReady: boolean, delayMs = DEFAULT_MS): boolean {
  const [ready, setReady] = useState(false);
  const rawReadyRef = useRef(rawReady);
  rawReadyRef.current = rawReady;

  useLayoutEffect(() => {
    if (!rawReady) {
      setReady(false);
    }
  }, [rawReady]);

  useEffect(() => {
    if (!rawReady) {
      return;
    }

    let cancelled = false;
    let raf = 0;
    const timer = window.setTimeout(() => {
      raf = window.requestAnimationFrame(() => {
        if (cancelled) return;
        if (!rawReadyRef.current) return;
        setReady(true);
      });
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [rawReady, delayMs]);

  return ready;
}
