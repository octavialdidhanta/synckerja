import { useEffect, useRef, useState } from "react";
import { ORDER_COVER_SLIDE_MS } from "@/synckerja-order/shared/lib/orderCoverSlides";

const SLIDE_MS = 500;

/**
 * Banner motion that always travels left to right.
 * The next photo waits on the left. The track then moves right, and the loop
 * resets without playing the animation backwards.
 */
export function useOneWayCoverSlide(count: number, paused = false, intervalMs = ORDER_COVER_SLIDE_MS) {
  const [visible, setVisible] = useState(0);
  const [phase, setPhase] = useState<0 | 1>(0);
  const [animate, setAnimate] = useState(false);
  const phaseRef = useRef<0 | 1>(0);
  const countRef = useRef(count);
  countRef.current = count;

  const settle = () => {
    if (phaseRef.current !== 1) return;
    phaseRef.current = 0;
    const total = countRef.current;
    setAnimate(false);
    setVisible((index) => (total < 2 ? 0 : (index + 1) % total));
    setPhase(0);
  };

  useEffect(() => {
    phaseRef.current = 0;
    setVisible(0);
    setPhase(0);
    setAnimate(false);
  }, [count]);

  useEffect(() => {
    if (paused || count < 2 || phase !== 0) return;
    const timer = window.setTimeout(() => {
      phaseRef.current = 1;
      setAnimate(true);
      setPhase(1);
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [paused, count, phase, intervalMs, visible]);

  useEffect(() => {
    if (phase !== 1) return;
    const timer = window.setTimeout(settle, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const total = Math.max(count, 1);
  const shown = visible % total;
  return {
    visible: shown,
    incoming: count < 2 ? shown : (shown + 1) % total,
    /** 0 parks on the current photo. 1 has slid the next photo in from the left. */
    phase: count < 2 ? (0 as const) : phase,
    animate: count >= 2 && animate,
    settle,
  };
}
