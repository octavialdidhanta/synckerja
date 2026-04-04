import { useEffect, useState } from 'react';

const HIDE_DEBOUNCE_MS = 200;

/**
 * Skeleton overlay for blocking loads only. When `blockingPending` flips false, debounce + rAF
 * before hiding (Loading Skeleton rule). Does not re-show the overlay if `blockingPending` spikes
 * again after hide (e.g. ensureInstagramVerifyToken) — avoids flicker.
 */
export function useInstagramConnectPageSkeletonGate(blockingPending: boolean): boolean {
  const [skeletonVisible, setSkeletonVisible] = useState(true);

  useEffect(() => {
    if (blockingPending) {
      setSkeletonVisible(true);
      return;
    }
    let rafId = 0;
    const t = window.setTimeout(() => {
      rafId = requestAnimationFrame(() => setSkeletonVisible(false));
    }, HIDE_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [blockingPending]);

  return skeletonVisible;
}
