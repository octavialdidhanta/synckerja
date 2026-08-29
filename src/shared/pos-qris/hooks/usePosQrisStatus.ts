import { useEffect, useRef, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PosQrisPaymentRequest } from "../types/posQris.types";

const POLL_MS = 3000;

export function usePosQrisStatus(paymentRequestId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<PosQrisPaymentRequest["status"] | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PosQrisPaymentRequest | null>(null);
  const [salesActivityId, setSalesActivityId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!paymentRequestId || !enabled) return;

    let cancelled = false;

    const applyRow = (row: Record<string, unknown> | null) => {
      if (!row || cancelled) return;
      setPaymentRequest(row as PosQrisPaymentRequest);
      setStatus(row.status as PosQrisPaymentRequest["status"]);
      if (row.sales_activity_id) {
        setSalesActivityId(String(row.sales_activity_id));
      }
    };

    const fetchOnce = async () => {
      const { data, error } = await supabase
        .from("xendit_payment_requests")
        .select("id, organization_id, payment_type, pos_pending_checkout_id, sales_activity_id, expected_amount, platform_fee_amount, status, qr_string, expires_at, paid_at, external_id")
        .eq("id", paymentRequestId)
        .maybeSingle();
      if (error) {
        console.error("usePosQrisStatus poll:", error.message);
        return;
      }
      applyRow(data as Record<string, unknown> | null);
    };

    void fetchOnce();

    const channel = supabase
      .channel(`pos-qris-${paymentRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "xendit_payment_requests",
          filter: `id=eq.${paymentRequestId}`,
        },
        (payload) => {
          applyRow(payload.new as Record<string, unknown>);
        },
      )
      .subscribe();

    pollRef.current = window.setInterval(() => {
      void fetchOnce();
    }, POLL_MS);

    return () => {
      cancelled = true;
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [paymentRequestId, enabled]);

  return {
    status,
    paymentRequest,
    salesActivityId,
    isPaid: status === "paid",
    isTerminal: status === "paid" || status === "expired" || status === "failed",
  };
}
