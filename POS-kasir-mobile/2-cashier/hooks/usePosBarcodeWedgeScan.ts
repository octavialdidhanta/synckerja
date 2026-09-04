import { useEffect, useRef } from "react";

const DEFAULT_INTER_KEY_MS = 100;
const MAX_BUFFER = 128;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * Keyboard-wedge barcode listener.
 * Flushes on Enter or after inter-key idle timeout (scanner bursts are fast).
 */
export function usePosBarcodeWedgeScan(args: {
  enabled: boolean;
  onScan: (raw: string) => void;
  interKeyMs?: number;
}) {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(args.onScan);
  onScanRef.current = args.onScan;
  const interKeyMs = args.interKeyMs ?? DEFAULT_INTER_KEY_MS;

  useEffect(() => {
    if (!args.enabled) return;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const flush = () => {
      clearTimer();
      const raw = bufferRef.current.trim();
      bufferRef.current = "";
      if (raw) onScanRef.current(raw);
    };

    const scheduleFlush = () => {
      clearTimer();
      timerRef.current = setTimeout(flush, interKeyMs);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        flush();
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        bufferRef.current += event.key;
        if (bufferRef.current.length > MAX_BUFFER) {
          bufferRef.current = bufferRef.current.slice(-MAX_BUFFER);
        }
        scheduleFlush();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimer();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [args.enabled, interKeyMs]);
}
