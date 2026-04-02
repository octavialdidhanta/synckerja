import { useEffect, useState } from "react";

const DEFAULT_HIDE_MS = 200;

/**
 * Keeps skeleton visible until `pending` is false, then debounces hide to avoid flicker
 * when multiple queries settle in adjacent ticks (Loading Skeleton rule).
 */
export function useDebouncedShowSkeleton(pending: boolean, debounceMs = DEFAULT_HIDE_MS): boolean {
  const [show, setShow] = useState(pending);

  useEffect(() => {
    if (pending) {
      setShow(true);
      return;
    }
    const id = window.setTimeout(() => setShow(false), debounceMs);
    return () => window.clearTimeout(id);
  }, [pending, debounceMs]);

  return show;
}
