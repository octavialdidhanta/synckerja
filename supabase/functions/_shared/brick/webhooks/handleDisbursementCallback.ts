import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodeSynckerjaExternalId } from "../synckerjaExternalId.ts";
import type { ParsedBrickDisbursementCallback } from "./parseBrickDisbursementCallback.ts";
import type { BrickDisbursementStatus } from "../brickApi.ts";
import { finalizePurchaseRequestGatewayPayment } from "../../finance/finalizePurchaseRequestGatewayPayment.ts";

function mapStatusFields(status: string): {
  rowStatus: string;
  isCompleted: boolean;
  isFailed: boolean;
} {
  const normalized = status.toLowerCase();
  const isCompleted = normalized === "completed" || normalized === "succeeded" || normalized === "success";
  const isFailed = normalized === "failed" || normalized === "rejected" || normalized === "cancelled";
  const rowStatus = isCompleted ? "completed" : isFailed ? "failed" : "processing";
  return { rowStatus, isCompleted, isFailed };
}

export function mapDisbursementStatusToParsed(
  status: BrickDisbursementStatus,
): ParsedBrickDisbursementCallback {
  return {
    eventId: status.id,
    status: status.status,
    amount: status.amount,
    referenceId: status.referenceId,
    disbursementId: status.id,
    feeAmount: status.feeAmount,
    failureCode: status.failureCode,
    failureMessage: status.failureMessage,
    createdAt: status.createdAt,
    raw: status.raw,
  };
}

export async function processBrickDisbursementStatusUpdate(
  admin: SupabaseClient,
  parsed: ParsedBrickDisbursementCallback,
): Promise<{ ok: boolean; completed: boolean }> {
  let row: Record<string, unknown> | null = null;

  if (parsed.referenceId) {
    const { data } = await admin
      .from("brick_disbursements")
      .select("*")
      .eq("reference_id", parsed.referenceId)
      .maybeSingle();
    row = data ?? null;
  }

  if (!row && parsed.disbursementId) {
    const { data } = await admin
      .from("brick_disbursements")
      .select("*")
      .eq("brick_disbursement_id", parsed.disbursementId)
      .maybeSingle();
    row = data ?? null;
  }

  if (!row) {
    console.warn("brick disbursement not found:", parsed.referenceId ?? parsed.disbursementId);
    return { ok: false, completed: false };
  }

  const { rowStatus, isCompleted, isFailed } = mapStatusFields(parsed.status);
  const organizationId = String(row.organization_id);
  const amount = parsed.amount > 0 ? parsed.amount : Number(row.amount);
  const sourceBankAccountId = row.source_bank_account_id
    ? String(row.source_bank_account_id)
    : null;

  await admin.from("brick_disbursements").update({
    status: rowStatus,
    brick_disbursement_id: parsed.disbursementId ?? row.brick_disbursement_id,
    fee_amount: parsed.feeAmount ?? row.fee_amount,
    failure_code: parsed.failureCode,
    failure_message: parsed.failureMessage,
    completed_at: isCompleted ? new Date().toISOString() : null,
    raw_response: parsed.raw,
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  if (isCompleted && sourceBankAccountId && parsed.disbursementId && amount > 0) {
    const { error: upsertErr } = await admin.rpc("upsert_bank_statement_from_brick_disbursement_callback", {
      p_organization_id: organizationId,
      p_bank_account_id: sourceBankAccountId,
      p_external_id: parsed.disbursementId,
      p_transaction_date: parsed.createdAt ?? new Date().toISOString(),
      p_amount: amount,
      p_description: `Brick disbursement ${parsed.referenceId ?? parsed.disbursementId}`,
      p_reference: parsed.referenceId,
      p_raw_payload: parsed.raw,
    });
    if (upsertErr) {
      console.error("upsert_bank_statement_from_brick_disbursement_callback:", upsertErr.message);
    }
  }

  const referenceId = parsed.referenceId ?? String(row.reference_id ?? "");
  const decoded = decodeSynckerjaExternalId(referenceId);
  const sourceType = String(row.source_type);
  const sourceId = String(row.source_id);

  if (decoded?.kind === "payroll_calc" || sourceType === "payroll_calculation") {
    const calcId = decoded?.sourceId ?? sourceId;
    await admin.from("employee_payroll_calculations").update({
      payment_status: isCompleted ? "paid" : isFailed ? "failed" : "processing",
      payment_reference: parsed.disbursementId ?? null,
      payment_date: isCompleted ? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", calcId);
  }

  if ((decoded?.kind === "purchase_request" || sourceType === "purchase_request") && isCompleted) {
    const prId = decoded?.sourceId ?? sourceId;
    await admin.from("purchase_requests").update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
    }).eq("id", prId);
    try {
      await finalizePurchaseRequestGatewayPayment(admin, prId);
    } catch (e) {
      console.error("finalize_purchase_request_gateway_payment:", e);
    }
  }

  if ((decoded?.kind === "purchase_request" || sourceType === "purchase_request") && isFailed) {
    const prId = decoded?.sourceId ?? sourceId;
    await admin.from("purchase_requests").update({
      payment_status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", prId);
  }

  if ((decoded?.kind === "debt_payment" || sourceType === "debt_payment") && isCompleted) {
    const debtPaymentId = decoded?.sourceId ?? sourceId;
    await admin.from("debt_payments").update({
      transaction_reference: parsed.disbursementId ?? null,
    }).eq("id", debtPaymentId);
  }

  return { ok: true, completed: isCompleted };
}
