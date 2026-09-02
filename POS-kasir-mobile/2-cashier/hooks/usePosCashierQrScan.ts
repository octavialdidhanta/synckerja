import { useEffect, useRef } from "react";
import { parseCashierQrPayload } from "@/synckerja-order/0-storefront/cashier-ticket/lib/buildCashierQrPayload";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Keyboard-wedge barcode scan listener for SYNK:{token} payloads. */
export function usePosCashierQrScan(args: {
  enabled: boolean;
  onScan: (claimToken: string) => void;
}) {
  const bufferRef = useRef("");
  const onScanRef = useRef(args.onScan);
  onScanRef.current = args.onScan;

  useEffect(() => {
    if (!args.enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Enter") {
        const raw = bufferRef.current.trim();
        bufferRef.current = "";
        if (!raw) return;
        const token = parseCashierQrPayload(raw) ?? parseCashierQrPayload(`SYNK:${raw}`);
        if (token) onScanRef.current(token);
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        bufferRef.current += event.key;
        if (bufferRef.current.length > 64) {
          bufferRef.current = bufferRef.current.slice(-64);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [args.enabled]);
}
