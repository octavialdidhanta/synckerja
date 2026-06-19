import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "../xenditClient.ts";
import { encodeXenditExternalId } from "../xenditExternalId.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { resolvePrimarySubAccount } from "./resolveSubAccount.ts";
import { finalizePurchaseRequestGatewayPayment } from "../../finance/finalizePurchaseRequestGatewayPayment.ts";
import { handleDisbursementWebhook } from "../webhooks/handleDisbursement.ts";
import { mapBankNameToCode } from "../../payroll/payrollBankCodes.ts";
import {
  logPayrollXenditDisburseBatch,
  maybeFinalizePayrollRun,
  syncOrgXenditWalletAfterPayroll,
} from "./finalizePayrollDisbursement.ts";
type DisbursementResponse = {
  id?: string;
  status?: string;
  external_id?: string;
  failure_code?: string;
  failure_reason?: string;
  description?: string;
};

function mapXenditDisbursementStatus(status: string | undefined): "completed" | "failed" | "processing" {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "COMPLETED" || normalized === "SUCCEEDED") return "completed";
  if (normalized === "FAILED") return "failed";
  return "processing";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDisbursementById(
  env: XenditEnvConfig,
  subAccountId: string,
  disbursementId: string,
): Promise<DisbursementResponse> {
  return xenditRequest<DisbursementResponse>(env.secretKey, {
    path: `/disbursements/${encodeURIComponent(disbursementId)}`,
    forUserId: subAccountId,
  });
}

async function pollDisbursementUntilTerminal(
  env: XenditEnvConfig,
  admin: SupabaseClient,
  subAccountId: string,
  row: Record<string, unknown>,
  externalId: string,
  maxAttempts = 5,
): Promise<Record<string, unknown>> {
  const xenditId = row.xendit_disbursement_id ? String(row.xendit_disbursement_id) : "";
  if (!xenditId) return row;

  let current = row;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const mapped = mapXenditDisbursementStatus(String(current.status ?? ""));
    if (mapped === "completed" || mapped === "failed") return current;

    if (attempt > 0) await sleep(2000);

    try {
      const apiRes = await fetchDisbursementById(env, subAccountId, xenditId);
      const nextStatus = mapXenditDisbursementStatus(apiRes.status);
      if (nextStatus === "processing") continue;

      await handleDisbursementWebhook(admin, env, {
        external_id: String(apiRes.external_id ?? externalId),
        status: apiRes.status,
        id: apiRes.id ?? xenditId,
        failure_code: apiRes.failure_code,
        failure_reason: apiRes.failure_reason,
        description: apiRes.description,
      });

      const { data: refreshed } = await admin
        .from("xendit_disbursements")
        .select("*")
        .eq("id", current.id)
        .maybeSingle();
      if (refreshed) current = refreshed as Record<string, unknown>;
    } catch (e) {
      console.error("pollDisbursementUntilTerminal:", e);
      break;
    }
  }

  return current;
}

export { mapBankNameToCode } from "../../payroll/payrollBankCodes.ts";

async function insertDisbursementRow(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.from("xendit_disbursements").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

async function callXenditDisburse(
  env: XenditEnvConfig,
  subAccountId: string,
  externalId: string,
  payload: {
    bank_code: string;
    account_holder_name: string;
    account_number: string;
    amount: number;
    description: string;
  },
): Promise<DisbursementResponse> {
  return xenditRequest<DisbursementResponse>(env.secretKey, {
    method: "POST",
    path: "/disbursements",
    forUserId: subAccountId,
    idempotencyKey: externalId,
    body: {
      external_id: externalId,
      bank_code: payload.bank_code,
      account_holder_name: payload.account_holder_name,
      account_number: payload.account_number,
      description: payload.description,
      amount: Math.floor(payload.amount),
    },
  });
}

export async function executeTenantDisbursement(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ rows: Record<string, unknown>[]; processed: number; failed: number }> {
  const sourceType = String(body.source_type ?? "").trim();
  const { data: settings } = await admin
    .from("organization_xendit_settings")
    .select("is_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!settings?.is_enabled) throw new Error("Xendit not enabled for this organization");

  const { subAccountId, accountRow } = await resolvePrimarySubAccount(admin, env, organizationId);
  if (String(accountRow.status ?? "") !== "active") {
    throw new Error(
      "Akun Xendit belum aktif. Selesaikan verifikasi legalitas di halaman Perbankan Xendit.",
    );
  }

  const rows: Record<string, unknown>[] = [];
  let processed = 0;
  let failed = 0;

  if (sourceType === "payroll_run") {
    const runId = String(body.payroll_run_id ?? "").trim();
    if (!runId) throw new Error("Missing payroll_run_id");

    const { data: calcs, error } = await admin
      .from("employee_payroll_calculations")
      .select("id, take_home_pay, payment_status, payout_snapshot")
      .eq("organization_id", organizationId)
      .eq("payroll_run_id", runId)
      .eq("payment_status", "pending");
    if (error) throw new Error(error.message);

    let totalThp = 0;

    for (const calc of calcs ?? []) {
      const calcId = String(calc.id);
      const snapshot = calc.payout_snapshot as Record<string, string> | null;
      const accountNumber = snapshot?.account_number?.trim() ?? "";
      const holder = snapshot?.account_holder?.trim() ?? "";
      const bankName = snapshot?.bank_name?.trim() ?? "";
      const amount = Number(calc.take_home_pay);
      if (!accountNumber || !holder || amount <= 0) {
        failed++;
        continue;
      }
      try {
        await admin
          .from("employee_payroll_calculations")
          .update({ payment_status: "processing" })
          .eq("id", calcId)
          .in("payment_status", ["pending", "failed"]);
        const row = await disburseSingle(admin, env, organizationId, userId, subAccountId, {
          source_type: "payroll_calculation",
          source_id: calcId,
          bank_code: mapBankNameToCode(bankName),
          account_holder_name: holder,
          account_number: accountNumber,
          amount,
          description: `Payroll ${calcId.slice(0, 8)}`,
        });
        rows.push(row);
        processed++;
        totalThp += amount;
      } catch (e) {
        failed++;
        console.error("payroll disburse failed", calcId, e);
      }
    }

    await maybeFinalizePayrollRun(admin, runId);
    await syncOrgXenditWalletAfterPayroll(admin, organizationId, env);
    if (processed > 0 || failed > 0) {
      await logPayrollXenditDisburseBatch(admin, organizationId, runId, userId, {
        processed,
        failed,
        total_thp: totalThp,
      });
    }

    return { rows, processed, failed };
  }

  const sourceId = String(body.source_id ?? "").trim();
  if (!sourceId) throw new Error("Missing source_id");

  if (sourceType === "payroll_calculation") {
    const { data: calc } = await admin
      .from("employee_payroll_calculations")
      .select("id, take_home_pay, payout_snapshot, payment_status")
      .eq("id", sourceId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!calc) throw new Error("Payroll calculation not found");
    const status = String(calc.payment_status ?? "");
    if (status !== "pending" && status !== "failed") {
      throw new Error("Payroll calculation is not eligible for disburse");
    }
    const snapshot = calc.payout_snapshot as Record<string, string> | null;
    await admin
      .from("employee_payroll_calculations")
      .update({ payment_status: "processing" })
      .eq("id", sourceId)
      .in("payment_status", ["pending", "failed"]);
    const row = await disburseSingle(admin, env, organizationId, userId, subAccountId, {
      source_type: "payroll_calculation",
      source_id: sourceId,
      bank_code: mapBankNameToCode(snapshot?.bank_name ?? ""),
      account_holder_name: snapshot?.account_holder ?? "",
      account_number: snapshot?.account_number ?? "",
      amount: Number(calc.take_home_pay),
      description: String(body.description ?? "Payroll disbursement"),
    });
    return { rows: [row], processed: 1, failed: 0 };
  }

  if (sourceType === "purchase_request") {
    const { data: pr } = await admin
      .from("purchase_requests")
      .select("id, amount_idr, vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder, request_title, paid_at")
      .eq("id", sourceId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!pr) throw new Error("Purchase request not found");
    if (pr.paid_at) throw new Error("Purchase request already paid");

    const bankCode = String(body.bank_code ?? pr.vendor_bank_code ?? "").trim().toUpperCase();
    const accountHolder = String(body.account_holder_name ?? pr.vendor_bank_account_holder ?? "").trim();
    const accountNumber = String(body.account_number ?? pr.vendor_bank_account_number ?? "").trim();
    const amount = Number(body.amount ?? pr.amount_idr);
    if (!bankCode || !accountHolder || !accountNumber || amount <= 0) {
      throw new Error("Missing vendor disbursement bank details");
    }

    await admin.from("purchase_requests").update({
      vendor_bank_code: bankCode,
      vendor_bank_account_holder: accountHolder,
      vendor_bank_account_number: accountNumber,
      payment_status: "processing",
      updated_at: new Date().toISOString(),
    }).eq("id", sourceId);

    const row = await disburseSingle(admin, env, organizationId, userId, subAccountId, {
      source_type: "purchase_request",
      source_id: sourceId,
      bank_code: bankCode,
      account_holder_name: accountHolder,
      account_number: accountNumber,
      amount,
      description: String(body.description ?? `Vendor payment ${pr.request_title ?? sourceId}`),
    });

    if (String(row.status ?? "") === "completed") {
      try {
        await finalizePurchaseRequestGatewayPayment(admin, sourceId);
      } catch (e) {
        console.error("finalize after xendit disburse:", e);
      }
    }

    return { rows: [row], processed: 1, failed: 0 };
  }

  if (sourceType === "debt_payment") {
    const bankCode = String(body.bank_code ?? "").trim().toUpperCase();
    const holder = String(body.account_holder_name ?? "").trim();
    const accountNumber = String(body.account_number ?? "").trim();
    const amount = Number(body.amount);
    if (!bankCode || !holder || !accountNumber || amount <= 0) {
      throw new Error("Missing debt disbursement bank details");
    }
    const row = await disburseSingle(admin, env, organizationId, userId, subAccountId, {
      source_type: "debt_payment",
      source_id: sourceId,
      bank_code: bankCode,
      account_holder_name: holder,
      account_number: accountNumber,
      amount,
      description: String(body.description ?? "Debt payment"),
    });
    await admin.from("debt_payments").update({ xendit_disbursement_id: row.id as string }).eq("id", sourceId);
    return { rows: [row], processed: 1, failed: 0 };
  }

  throw new Error(`Unknown source_type: ${sourceType}`);
}

export async function disburseSingle(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  userId: string,
  subAccountId: string,
  input: {
    source_type: string;
    source_id: string;
    bank_code: string;
    account_holder_name: string;
    account_number: string;
    amount: number;
    description: string;
  },
): Promise<Record<string, unknown>> {
  const kind = input.source_type === "payroll_calculation"
    ? "payroll_calc"
    : input.source_type === "purchase_request"
    ? "purchase_request"
    : input.source_type === "gateway_withdrawal"
    ? "gateway_withdrawal"
    : "debt_payment";
  const externalId = encodeXenditExternalId(kind, organizationId, input.source_id);

  const pendingRow = await insertDisbursementRow(admin, {
    organization_id: organizationId,
    source_type: input.source_type,
    source_id: input.source_id,
    sub_account_id: subAccountId,
    external_id: externalId,
    bank_code: input.bank_code,
    account_holder_name: input.account_holder_name,
    account_number: input.account_number,
    amount: input.amount,
    description: input.description,
    status: "pending",
    initiated_by: userId,
  });

  try {
    const apiRes = await callXenditDisburse(env, subAccountId, externalId, input);
    const initialStatus = mapXenditDisbursementStatus(apiRes.status);
    const { data: updated, error } = await admin
      .from("xendit_disbursements")
      .update({
        status: initialStatus,
        xendit_disbursement_id: apiRes.id != null ? String(apiRes.id) : null,
        completed_at: initialStatus === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingRow.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    let result = updated as Record<string, unknown>;
    if (initialStatus === "processing" && apiRes.id) {
      result = await pollDisbursementUntilTerminal(
        env,
        admin,
        subAccountId,
        result,
        externalId,
      );
    } else if (initialStatus === "completed" || initialStatus === "failed") {
      await handleDisbursementWebhook(admin, env, {
        external_id: externalId,
        status: apiRes.status ?? (initialStatus === "completed" ? "COMPLETED" : "FAILED"),
        id: apiRes.id ?? null,
        failure_code: apiRes.failure_code,
        failure_reason: apiRes.failure_reason,
        description: apiRes.description,
      });
      const { data: refreshed } = await admin
        .from("xendit_disbursements")
        .select("*")
        .eq("id", pendingRow.id)
        .maybeSingle();
      if (refreshed) result = refreshed as Record<string, unknown>;
    }

    if (
      input.source_type === "purchase_request" &&
      String(result.status ?? "") === "completed"
    ) {
      try {
        await finalizePurchaseRequestGatewayPayment(admin, input.source_id);
      } catch (e) {
        console.error("finalize after inline poll:", e);
      }
    }

    return result;
  } catch (e) {    const message = e instanceof Error ? e.message : String(e);
    await admin.from("xendit_disbursements").update({
      status: "failed",
      failure_message: message,
      updated_at: new Date().toISOString(),
    }).eq("id", pendingRow.id);
    throw e;
  }
}
