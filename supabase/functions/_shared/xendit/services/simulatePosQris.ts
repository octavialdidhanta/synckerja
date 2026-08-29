import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";

/**
 * Sandbox-only QA helper: simulate QR payment then settle in Synckerja.
 * Prefer this over scanning with real e-wallet apps (sandbox QR is not scannable).
 */
export async function simulatePosQrisPayment(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  input: {
    payment_request_id?: string;
    pending_checkout_id?: string;
  },
): Promise<Record<string, unknown>> {
  if (!env.isSandbox) {
    throw new Error("pos_qris_simulate_sandbox_only");
  }

  const paymentRequestId = input.payment_request_id?.trim() ?? "";
  const pendingId = input.pending_checkout_id?.trim() ?? "";

  let query = admin
    .from("xendit_payment_requests")
    .select(
      "id, status, external_id, expected_amount, sub_account_id, xendit_qr_id, payment_type, organization_id",
    )
    .eq("organization_id", organizationId)
    .eq("payment_type", "qris");

  if (paymentRequestId) {
    query = query.eq("id", paymentRequestId);
  } else if (pendingId) {
    query = query.eq("pos_pending_checkout_id", pendingId).eq("status", "pending");
  } else {
    throw new Error("Missing payment_request_id or pending_checkout_id");
  }

  const { data: req, error: reqErr } = await query.maybeSingle();
  if (reqErr) throw new Error(reqErr.message);
  if (!req) throw new Error("Payment request not found");
  if (req.status === "paid") {
    return { ok: true, already_paid: true, payment_request_id: req.id };
  }

  const externalId = String(req.external_id ?? "").trim();
  const amount = Math.floor(Number(req.expected_amount ?? 0));
  const subAccountId = req.sub_account_id != null ? String(req.sub_account_id).trim() : "";

  if (externalId && amount > 0) {
    try {
      await xenditRequest(env.secretKey, {
        method: "POST",
        path: `/qr_codes/${encodeURIComponent(externalId)}/payments/simulate`,
        forUserId: subAccountId || null,
        body: { amount },
      });
    } catch (e) {
      // Settlement below still completes QA even if Xendit simulate is flaky.
      console.warn("simulatePosQrisPayment: Xendit simulate failed, settling locally", e);
    }
  }

  const { error: settleErr } = await admin.rpc("apply_xendit_qris_settlement", {
    p_payment_request_id: req.id,
    p_xendit_payment_id: `sandbox_sim_${req.id}`,
  });
  if (settleErr) throw new Error(settleErr.message);

  return { ok: true, payment_request_id: req.id, simulated: true };
}
