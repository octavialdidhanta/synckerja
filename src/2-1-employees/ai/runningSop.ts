import { useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";

/** A run still marked running after this long is treated as stuck, so the spinner stops. */
export const RUN_STALE_MS = 15 * 60 * 1000;
const IDLE_POLL_MS = 15_000;
const BUSY_POLL_MS = 5_000;

export function runningSince(now: Date = new Date()): string {
  return new Date(now.getTime() - RUN_STALE_MS).toISOString();
}

/**
 * True while an SOP run of this AI employee is running (scheduled or manual).
 * Polls ai_employee_runs; calls onFinished once when a running run ends.
 */
export function useSopRunning(
  employeeId: string | null | undefined,
  sopCode: string,
  onFinished?: () => void,
): boolean {
  const [running, setRunning] = useState(false);
  const wasRunning = useRef(false);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timer = setTimeout(check, IDLE_POLL_MS);
        return;
      }
      const { data, error } = await supabase
        .from("ai_employee_runs")
        .select("id")
        .eq("employee_id", employeeId)
        .eq("sop_code", sopCode)
        .eq("status", "running")
        .gte("started_at", runningSince())
        .limit(1);
      if (cancelled) return;
      const now = !error && Array.isArray(data) && data.length > 0;
      if (wasRunning.current && !now) finished.current?.();
      wasRunning.current = now;
      setRunning(now);
      timer = setTimeout(check, now ? BUSY_POLL_MS : IDLE_POLL_MS);
    };

    void check();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [employeeId, sopCode]);

  return running;
}
