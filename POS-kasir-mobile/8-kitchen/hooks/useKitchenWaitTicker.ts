import { useEffect, useState } from "react";

const TICK_MS = 1_000;

/** Shared clock for KDS wait/SLA labels (updates every second — live). */
export function useKitchenWaitTicker(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return nowMs;
}
