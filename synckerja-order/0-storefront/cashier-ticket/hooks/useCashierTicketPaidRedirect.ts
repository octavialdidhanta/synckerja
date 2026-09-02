import { useEffect, useRef } from "react";

const DEFAULT_DELAY_MS = 2000;

export function useCashierTicketPaidRedirect(args: {
  isPaid: boolean;
  onReturnToMenu: () => void;
  delayMs?: number;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!args.isPaid) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    const timer = window.setTimeout(args.onReturnToMenu, args.delayMs ?? DEFAULT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [args.isPaid, args.onReturnToMenu, args.delayMs]);
}
