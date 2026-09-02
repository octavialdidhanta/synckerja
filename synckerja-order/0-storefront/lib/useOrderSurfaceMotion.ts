import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MS = 220;

/** Fast ease-in-out presence for storefront drawer / full-screen detail. */
export function useOrderSurfaceMotion(onClose: () => void, durationMs = DEFAULT_MS) {
  const [exiting, setExiting] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(() => {
      onCloseRef.current();
      setExiting(false);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [exiting, durationMs]);

  const requestClose = useCallback(() => {
    setExiting(true);
  }, []);

  return {
    exiting,
    requestClose,
    durationMs,
  };
}

/** Backdrop: fade. */
export function orderBackdropMotionClass(exiting: boolean) {
  return exiting
    ? "animate-out fade-out duration-200 fill-mode-forwards ease-in-out"
    : "animate-in fade-in duration-200 ease-in-out";
}

/** Bottom sheet panel: slide from bottom. */
export function orderSheetPanelMotionClass(exiting: boolean) {
  return exiting
    ? "animate-out slide-out-to-bottom duration-200 fill-mode-forwards ease-in-out"
    : "animate-in slide-in-from-bottom duration-200 ease-in-out";
}

/** Full-screen detail: fade + slight rise. */
export function orderDetailMotionClass(exiting: boolean) {
  return exiting
    ? "animate-out fade-out slide-out-to-bottom-2 duration-200 fill-mode-forwards ease-in-out"
    : "animate-in fade-in slide-in-from-bottom-2 duration-200 ease-in-out";
}
