import { useLayoutEffect, useState } from 'react';

const HIDE_DEBOUNCE_MS = 220;

/**
 * Debounce + double rAF setelah `useLayoutEffect` agar layout konten stabil sebelum skeleton hilang (kurangi flicker).
 */
export function useSocialMediaSettingsPageSkeletonGate(rawPending: boolean): boolean {
  const [revealed, setRevealed] = useState(false);

  useLayoutEffect(() => {
    if (rawPending) {
      setRevealed(false);
      return;
    }
    const handles = { timeoutId: 0 as number, raf1: 0 as number, raf2: 0 as number };
    handles.timeoutId = window.setTimeout(() => {
      handles.raf1 = requestAnimationFrame(() => {
        handles.raf2 = requestAnimationFrame(() => setRevealed(true));
      });
    }, HIDE_DEBOUNCE_MS);
    return () => {
      clearTimeout(handles.timeoutId);
      cancelAnimationFrame(handles.raf1);
      cancelAnimationFrame(handles.raf2);
    };
  }, [rawPending]);

  return rawPending || !revealed;
}
