import { useEffect, useRef } from "react";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { supabase } from "@/shared/lib/supabaseClient";
import { cartLineFingerprint } from "../lib/cartLineFingerprint";

export function usePosSynckerjaGuestCartSync(args: {
  enabled: boolean;
  sessionId: string | null;
  cartReplaceLines: (lines: CustomerVisitCartLine[]) => void;
  onGuestUpdated: () => void;
}) {
  const lastFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    if (!args.enabled || !args.sessionId) {
      lastFingerprintRef.current = null;
      return;
    }

    const channel = supabase
      .channel(`pos-synckerja-guest-cart-${args.sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pos_table_sessions",
          filter: `id=eq.${args.sessionId}`,
        },
        (payload) => {
          const snap = (payload.new as { cart_snapshot?: unknown })?.cart_snapshot;
          if (!Array.isArray(snap)) return;
          const lines = snap as CustomerVisitCartLine[];
          const fingerprint = cartLineFingerprint(lines);
          if (lastFingerprintRef.current === null) {
            lastFingerprintRef.current = fingerprint;
            return;
          }
          if (fingerprint === lastFingerprintRef.current) return;
          lastFingerprintRef.current = fingerprint;
          args.cartReplaceLines(lines);
          args.onGuestUpdated();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      lastFingerprintRef.current = null;
    };
  }, [args.enabled, args.sessionId, args.cartReplaceLines, args.onGuestUpdated]);
}
