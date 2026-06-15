import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { decodeXenditExternalId } from "../xenditExternalId.ts";
import { finalizePurchaseRequestGatewayPayment } from "../../finance/finalizePurchaseRequestGatewayPayment.ts";
import { finalizeGatewayWithdrawal } from "../services/executeGatewayWithdrawal.ts";

export async function handleDisbursementWebhook(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  payload: Record<string, unknown>,
): Promise<void> {
  const externalId = String(payload.external_id ?? "").trim();
  const status = String(payload.status ?? "").toUpperCase();
  if (!externalId) throw new Error("Missing external_id in disbursement webhook");

  const { data: row } = await admin
    .from("xendit_disbursements")
    .select("*")
    .eq("external_id", externalId)
    .maybeSingle();
  if (!row) throw new Error(`Disbursement not found: ${externalId}`);

  const isCompleted = status === "COMPLETED" || status === "SUCCEEDED";
  const isFailed = status === "FAILED";

  const failureMessage = payload.failure_reason != null
    ? String(payload.failure_reason)
    : payload.description != null
    ? String(payload.description)
    : null;

  await admin.from("xendit_disbursements").update({
    status: isCompleted ? "completed" : isFailed ? "failed" : "processing",
    xendit_disbursement_id: payload.id != null ? String(payload.id) : row.xendit_disbursement_id,
    failure_code: payload.failure_code != null ? String(payload.failure_code) : null,
    failure_message: failureMessage,
    completed_at: isCompleted ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  const decoded = decodeXenditExternalId(externalId);
  if (!decoded) return;

  if (decoded.kind === "gateway_withdrawal") {
    if (isCompleted) {
      try {
        await finalizeGatewayWithdrawal(admin, env, String(row.id), decoded.organizationId);
      } catch (e) {
        console.error("finalizeGatewayWithdrawal:", e);
        throw e;
      }
    } else if (isFailed) {
      await admin
        .from("xendit_gateway_withdrawals")
        .update({
          status: "failed",
          failure_message: failureMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", decoded.sourceId);
    }
    return;
  }

  if (decoded.kind === "payroll_calc") {
    await admin.from("employee_payroll_calculations").update({
      payment_status: isCompleted ? "paid" : isFailed ? "failed" : "processing",
      payment_reference: payload.id != null ? String(payload.id) : null,
      payment_date: isCompleted ? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", decoded.sourceId);
  }

  if (decoded.kind === "purchase_request" && isCompleted) {
    await admin.from("purchase_requests").update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
    }).eq("id", decoded.sourceId);

    try {
      await finalizePurchaseRequestGatewayPayment(admin, decoded.sourceId);
    } catch (e) {
      console.error("finalize_purchase_request_gateway_payment:", e);
    }
  }

  if (decoded.kind === "purchase_request" && isFailed) {
    await admin.from("purchase_requests").update({
      payment_status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", decoded.sourceId);
  }

  if (decoded.kind === "debt_payment" && isCompleted) {
    await admin.from("debt_payments").update({
      transaction_reference: payload.id != null ? String(payload.id) : null,
    }).eq("id", decoded.sourceId);
  }
}
