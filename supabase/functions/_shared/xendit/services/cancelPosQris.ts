import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";

export async function cancelPosQrisPayment(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  input: {
    pending_checkout_id?: string;
    payment_request_id?: string;
    reason?: string;
  },
): Promise<Record<string, unknown>> {
  const pendingId = input.pending_checkout_id?.trim() ?? "";
  const paymentRequestId = input.payment_request_id?.trim() ?? "";
  const reason = input.reason?.trim() || "cancelled";

  let resolvedPendingId = pendingId;
  let xenditQrId: string | null = null;

  if (paymentRequestId) {
    const { data: req, error: reqErr } = await admin
      .from("xendit_payment_requests")
      .select("id, pos_pending_checkout_id, xendit_qr_id, status, organization_id")
      .eq("id", paymentRequestId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Payment request not found");
    if (req.status === "paid") return { ok: true, already_paid: true };
    resolvedPendingId = String(req.pos_pending_checkout_id ?? resolvedPendingId);
    xenditQrId = req.xendit_qr_id != null ? String(req.xendit_qr_id) : null;
  } else if (pendingId) {
    const { data: req } = await admin
      .from("xendit_payment_requests")
      .select("xendit_qr_id, status")
      .eq("pos_pending_checkout_id", pendingId)
      .eq("status", "pending")
      .maybeSingle();
    xenditQrId = req?.xendit_qr_id != null ? String(req.xendit_qr_id) : null;
  }

  if (!resolvedPendingId) throw new Error("Missing pending_checkout_id or payment_request_id");

  if (xenditQrId) {
    try {
      await xenditRequest(env.secretKey, {
        method: "POST",
        path: `/qr_codes/${encodeURIComponent(xenditQrId)}/expire`,
        body: {},
      });
    } catch (e) {
      console.warn("cancelPosQrisPayment: Xendit expire failed", e);
    }
  }

  const { error } = await admin.rpc("pos_cancel_pending_checkout", {
    p_pending_id: resolvedPendingId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);

  return { ok: true, pending_checkout_id: resolvedPendingId };
}
