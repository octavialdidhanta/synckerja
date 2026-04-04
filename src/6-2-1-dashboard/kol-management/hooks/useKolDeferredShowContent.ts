import { useEffect, useRef, useState } from "react";

const HIDE_DEBOUNCE_MS = 200;

/**
 * Skeleton hilang hanya setelah `rawPending` false + debounce singkat + frame berikutnya
 * (mengurangi kedip satu frame; lihat Loading Skeleton rule).
 */
export function useKolDeferredShowContent(rawPending: boolean) {
  const [showContent, setShowContent] = useState(() => !rawPending);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const raf2Ref = useRef<number | null>(null);

  useEffect(() => {
    if (rawPending) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (raf2Ref.current != null) cancelAnimationFrame(raf2Ref.current);
      raf2Ref.current = null;
      setShowContent(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        raf2Ref.current = requestAnimationFrame(() => {
          raf2Ref.current = null;
          setShowContent(true);
        });
      });
    }, HIDE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (raf2Ref.current != null) cancelAnimationFrame(raf2Ref.current);
    };
  }, [rawPending]);

  return showContent;
}
