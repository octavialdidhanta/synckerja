import { useEffect, useState } from 'react';

const HIDE_DEBOUNCE_MS = 200;

/** Debounce + rAF sebelum hilangkan skeleton (Loading Skeleton rule). */
export function useProductKnowledgePageSkeletonGate(rawPending: boolean): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (rawPending) {
      setRevealed(false);
      return;
    }
    let rafId = 0;
    const t = window.setTimeout(() => {
      rafId = requestAnimationFrame(() => setRevealed(true));
    }, HIDE_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [rawPending]);

  return rawPending || !revealed;
}
