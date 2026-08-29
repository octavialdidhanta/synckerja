import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  createPosQrisPaymentRequest,
  cancelPosQrisPaymentRequest,
  simulatePosQrisPaymentRequest,
} from "../api/posQrisApi";
import { buildPendingCheckoutPayload, type BuildPendingCheckoutPayloadArgs } from "../lib/buildPendingCheckoutPayload";
import type { PosQrisCreateResult } from "../types/posQris.types";

export function usePosQrisPayment() {
  const createMutation = useMutation({
    mutationFn: async (args: {
      organizationId: string;
      outletId: string;
      checkout: BuildPendingCheckoutPayloadArgs;
    }): Promise<PosQrisCreateResult> => {
      const payload = await buildPendingCheckoutPayload(args.checkout);
      const { data, error } = await supabase.rpc("pos_create_pending_checkout", {
        p_organization_id: args.organizationId,
        p_outlet_id: args.outletId,
        p_payload: payload,
      });
      if (error) throw error;
      const body = data as { ok?: boolean; pending_checkout_id?: string; expires_at?: string };
      const pendingCheckoutId = String(body.pending_checkout_id ?? "");
      if (!pendingCheckoutId) throw new Error("pos_qris_pending_create_failed");

      const paymentRequest = await createPosQrisPaymentRequest(args.organizationId, pendingCheckoutId);
      return {
        ok: true,
        pending_checkout_id: pendingCheckoutId,
        // Prefer QR request TTL (60s), not pending checkout buffer (90s).
        expires_at: String(paymentRequest.expires_at ?? body.expires_at ?? ""),
        payment_request: paymentRequest,
      };
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (args: {
      organizationId: string;
      pendingCheckoutId?: string;
      paymentRequestId?: string;
      reason?: string;
    }) => {
      await cancelPosQrisPaymentRequest(args.organizationId, {
        pendingCheckoutId: args.pendingCheckoutId,
        paymentRequestId: args.paymentRequestId,
        reason: args.reason,
      });
    },
  });

  const simulateMutation = useMutation({
    mutationFn: async (args: {
      organizationId: string;
      paymentRequestId?: string;
      pendingCheckoutId?: string;
    }) => {
      await simulatePosQrisPaymentRequest(args.organizationId, {
        paymentRequestId: args.paymentRequestId,
        pendingCheckoutId: args.pendingCheckoutId,
      });
    },
  });

  return {
    createQrisPayment: createMutation.mutateAsync,
    cancelQrisPayment: cancelMutation.mutateAsync,
    simulateQrisPayment: simulateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isSimulating: simulateMutation.isPending,
  };
}
