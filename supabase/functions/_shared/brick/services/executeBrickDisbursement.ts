import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createBrickDisbursement,
  getBrickDisbursementStatus,
  isBrickSandboxDisburseTestAccount,
  resolveBankShortCode,
  resolveBrickDisburseBeneficiary,
  BRICK_SANDBOX_DISBURSE_ACCOUNT,
  type BrickDisbursementStatus,
  type BrickEnv,
} from "../brickApi.ts";
import { finalizePurchaseRequestGatewayPayment } from "../../finance/finalizePurchaseRequestGatewayPayment.ts";

function mapBankNameToCode(bankName: string): string {
  const resolved = resolveBankShortCode(bankName);
  return resolved ?? bankName.trim().toUpperCase().replace(/\s+/g, "_");
}

async function requireLinkedBrickAccount(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const { count } = await admin
    .from("bank_accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("brick_link_status", "linked");
  if (!count) throw new Error("No Brick-linked bank account. Link a bank account first.");
}

async function resolveSourceBankAccountId(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc("resolve_brick_disbursement_source_bank_account_id", {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  return data != null ? String(data) : null;
}

async function insertDisbursementRow(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.from("brick_disbursements").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

function brickDisbursementReferenceId(sourceType: string, sourceId: string, retry = false): string {
  const base = `disb-${sourceType}-${sourceId}`;
  return retry ? `${base}-r${Date.now()}` : base;
}

async function tryGetBrickDisbursementStatus(
  env: BrickEnv,
  referenceId: string,
): Promise<BrickDisbursementStatus | null> {
  try {
    return await getBrickDisbursementStatus(env, { referenceId });
  } catch {
    return null;
  }
}

async function applyBrickDisbursementApiResult(
  admin: SupabaseClient,
  rowId: string,
  apiRes: { id: string; status: string; raw: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const apiStatus = String(apiRes.status ?? "processing").toLowerCase();
  const rowStatus = mapBrickDisbursementRowStatus(apiStatus);
  const attrs = ((apiRes.raw?.attributes as Record<string, unknown> | undefined) ?? apiRes.raw) as
    | Record<string, unknown>
    | undefined;
  const failureMessage = attrs?.errorMessage ?? attrs?.failureMessage ?? null;
  const failureCode = attrs?.errorCode ?? attrs?.failureCode ?? null;

  const { data: updated, error } = await admin
    .from("brick_disbursements")
    .update({
      status: rowStatus,
      brick_disbursement_id: apiRes.id || null,
      failure_code: rowStatus === "failed" && failureCode != null ? String(failureCode) : null,
      failure_message: rowStatus === "failed" && failureMessage != null
        ? String(failureMessage)
        : rowStatus === "failed"
          ? "Brick disbursement failed"
          : null,
      raw_response: apiRes.raw,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return updated as Record<string, unknown>;
}

function mapBrickDisbursementRowStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "succeeded" || normalized === "success") {
    return "completed";
  }
  if (normalized === "failed" || normalized === "rejected" || normalized === "cancelled") {
    return "failed";
  }
  return "processing";
}

async function submitBrickDisbursement(
  admin: SupabaseClient,
  env: BrickEnv,
  rowId: string,
  input: {
    referenceId: string;
    description: string;
    amount: number;
    bankShortCode: string;
    bankAccountNo: string;
    bankAccountHolderName: string;
  },
): Promise<Record<string, unknown>> {
  const existing = await tryGetBrickDisbursementStatus(env, input.referenceId);
  if (existing?.id) {
    const st = existing.status.toLowerCase();
    if (st === "processing" || st === "completed" || st === "pending") {
      return applyBrickDisbursementApiResult(admin, rowId, {
        id: existing.id,
        status: existing.status,
        raw: existing.raw,
      });
    }
  }

  try {
    const apiRes = await createBrickDisbursement(env, input);
    return applyBrickDisbursementApiResult(admin, rowId, apiRes);
  } catch (e) {
    const polled = await tryGetBrickDisbursementStatus(env, input.referenceId);
    if (polled?.id) {
      const st = polled.status.toLowerCase();
      if (st === "processing" || st === "completed" || st === "pending") {
        return applyBrickDisbursementApiResult(admin, rowId, {
          id: polled.id,
          status: polled.status,
          raw: polled.raw,
        });
      }
    }
    throw e;
  }
}

async function prepareDisbursementRow(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  sourceBankAccountId: string | null,
  input: {
    source_type: string;
    source_id: string;
    reference_id: string;
    bank_short_code: string;
    account_holder_name: string;
    account_no: string;
    amount: number;
    description: string;
  },
): Promise<Record<string, unknown>> {
  const { data: inProgress } = await admin
    .from("brick_disbursements")
    .select("id, status")
    .eq("source_type", input.source_type)
    .eq("source_id", input.source_id)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (inProgress) {
    throw new Error("Disbursement already in progress for this payment. Wait for callback or refresh bank sync.");
  }

  const { data: completed } = await admin
    .from("brick_disbursements")
    .select("id")
    .eq("source_type", input.source_type)
    .eq("source_id", input.source_id)
    .eq("status", "completed")
    .maybeSingle();
  if (completed) {
    throw new Error("Disbursement already completed for this payment.");
  }

  const { data: failed } = await admin
    .from("brick_disbursements")
    .select("*")
    .eq("source_type", input.source_type)
    .eq("source_id", input.source_id)
    .eq("status", "failed")
    .maybeSingle();

  if (failed?.id) {
    const retryReferenceId = brickDisbursementReferenceId(input.source_type, input.source_id, true);
    const { data: updated, error } = await admin
      .from("brick_disbursements")
      .update({
        reference_id: retryReferenceId,
        bank_short_code: input.bank_short_code,
        account_holder_name: input.account_holder_name,
        account_no: input.account_no,
        amount: input.amount,
        description: input.description,
        status: "pending",
        failure_code: null,
        failure_message: null,
        source_bank_account_id: sourceBankAccountId,
        initiated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", failed.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated as Record<string, unknown>;
  }

  return insertDisbursementRow(admin, {
    organization_id: organizationId,
    source_type: input.source_type,
    source_id: input.source_id,
    reference_id: input.reference_id,
    bank_short_code: input.bank_short_code,
    account_holder_name: input.account_holder_name,
    account_no: input.account_no,
    amount: input.amount,
    description: input.description,
    status: "pending",
    source_bank_account_id: sourceBankAccountId,
    initiated_by: userId,
  });
}

async function disburseSingle(
  admin: SupabaseClient,
  env: BrickEnv,
  organizationId: string,
  userId: string,
  sourceBankAccountId: string | null,
  input: {
    source_type: string;
    source_id: string;
    bank_short_code: string;
    account_holder_name: string;
    account_no: string;
    amount: number;
    description: string;
  },
): Promise<Record<string, unknown>> {
  const referenceId = brickDisbursementReferenceId(input.source_type, input.source_id);

  let bankShortCode = input.bank_short_code.trim().toUpperCase();
  if (isBrickSandboxDisburseTestAccount(bankShortCode, input.account_no, input.account_holder_name)) {
    bankShortCode = BRICK_SANDBOX_DISBURSE_ACCOUNT.bankShortCode;
  }

  const validated = await resolveBrickDisburseBeneficiary(
    env,
    input.account_no,
    bankShortCode,
    input.account_holder_name,
  );

  const pendingRow = await prepareDisbursementRow(admin, organizationId, userId, sourceBankAccountId, {
    ...input,
    bank_short_code: bankShortCode,
    reference_id: referenceId,
    account_holder_name: validated.accountName || input.account_holder_name,
    account_no: validated.accountNo || input.account_no,
  });

  try {
    return await submitBrickDisbursement(admin, env, String(pendingRow.id), {
      referenceId: String(pendingRow.reference_id ?? referenceId),
      description: input.description,
      amount: input.amount,
      bankShortCode,
      bankAccountNo: validated.accountNo || input.account_no,
      bankAccountHolderName: validated.accountName || input.account_holder_name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("brick_disbursements").update({
      status: "failed",
      failure_message: message,
      updated_at: new Date().toISOString(),
    }).eq("id", pendingRow.id);
    throw e;
  }
}

export async function executeTenantBrickDisbursement(
  admin: SupabaseClient,
  env: BrickEnv,
  organizationId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ rows: Record<string, unknown>[]; processed: number; failed: number }> {
  await requireLinkedBrickAccount(admin, organizationId);
  const sourceBankAccountId = await resolveSourceBankAccountId(admin, organizationId);

  const sourceType = String(body.source_type ?? "").trim();
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
        const row = await disburseSingle(admin, env, organizationId, userId, sourceBankAccountId, {
          source_type: "payroll_calculation",
          source_id: calcId,
          bank_short_code: mapBankNameToCode(bankName),
          account_holder_name: holder,
          account_no: accountNumber,
          amount,
          description: `Payroll ${calcId.slice(0, 8)}`,
        });
        await admin.from("employee_payroll_calculations").update({ payment_status: "processing" }).eq("id", calcId);
        rows.push(row);
        processed++;
      } catch (e) {
        failed++;
        console.error("brick payroll disburse failed", calcId, e);
      }
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
    const snapshot = calc.payout_snapshot as Record<string, string> | null;
    const row = await disburseSingle(admin, env, organizationId, userId, sourceBankAccountId, {
      source_type: "payroll_calculation",
      source_id: sourceId,
      bank_short_code: mapBankNameToCode(snapshot?.bank_name ?? ""),
      account_holder_name: snapshot?.account_holder ?? "",
      account_no: snapshot?.account_number ?? "",
      amount: Number(calc.take_home_pay),
      description: String(body.description ?? "Payroll disbursement"),
    });
    await admin.from("employee_payroll_calculations").update({ payment_status: "processing" }).eq("id", sourceId);
    return { rows: [row], processed: 1, failed: 0 };
  }

  if (sourceType === "purchase_request") {
    const { data: pr } = await admin
      .from("purchase_requests")
      .select("id, amount_idr, vendor_bank_code, vendor_bank_account_number, vendor_bank_account_holder, request_title, paid_at, payment_status")
      .eq("id", sourceId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!pr) throw new Error("Purchase request not found");
    if (pr.paid_at) throw new Error("Purchase request already paid");
    if (pr.payment_status === "processing") {
      throw new Error("Payment already in progress. Wait for Brick callback or use bank sync to refresh status.");
    }

    const bankCode = String(body.bank_code ?? pr.vendor_bank_code ?? "").trim().toUpperCase();
    const accountHolder = String(body.account_holder_name ?? pr.vendor_bank_account_holder ?? "").trim();
    const accountNumber = String(body.account_number ?? pr.vendor_bank_account_number ?? "").trim();
    const amount = Number(body.amount ?? pr.amount_idr);
    if (!bankCode || !accountHolder || !accountNumber || amount <= 0) {
      throw new Error("Missing vendor disbursement bank details");
    }

    if (Deno.env.get("BRICK_SANDBOX") !== "false" && amount > 100_000) {
      throw new Error(
        "Sandbox Brick: use amount ≤ Rp 100,000 (recommended Rp 10,000). Update purchase request amount_idr or use a smaller test row.",
      );
    }

    const row = await disburseSingle(admin, env, organizationId, userId, sourceBankAccountId, {
      source_type: "purchase_request",
      source_id: sourceId,
      bank_short_code: bankCode,
      account_holder_name: accountHolder,
      account_no: accountNumber,
      amount,
      description: String(body.description ?? `Vendor payment ${pr.request_title ?? sourceId}`),
    });

    const rowStatus = String(row.status ?? "processing");
    const prPatch: Record<string, unknown> = {
      vendor_bank_code: bankCode,
      vendor_bank_account_holder: accountHolder,
      vendor_bank_account_number: accountNumber,
      updated_at: new Date().toISOString(),
    };

    if (rowStatus === "completed") {
      prPatch.payment_status = "paid";
      prPatch.paid_at = new Date().toISOString();
    } else if (rowStatus === "failed") {
      prPatch.payment_status = "pending";
      const failureMessage = row.failure_message
        ? String(row.failure_message)
        : "Brick disbursement failed. Check sandbox wallet balance and retry.";
      await admin.from("purchase_requests").update(prPatch).eq("id", sourceId);
      throw new Error(failureMessage);
    } else {
      prPatch.payment_status = "processing";
    }

    await admin.from("purchase_requests").update(prPatch).eq("id", sourceId);

    if (rowStatus === "completed") {
      try {
        await finalizePurchaseRequestGatewayPayment(admin, sourceId);
      } catch (e) {
        console.error("finalize after brick disburse:", e);
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
    const row = await disburseSingle(admin, env, organizationId, userId, sourceBankAccountId, {
      source_type: "debt_payment",
      source_id: sourceId,
      bank_short_code: bankCode,
      account_holder_name: holder,
      account_no: accountNumber,
      amount,
      description: String(body.description ?? "Debt payment"),
    });
    await admin.from("debt_payments").update({ brick_disbursement_id: row.id as string }).eq("id", sourceId);
    return { rows: [row], processed: 1, failed: 0 };
  }

  throw new Error(`Unknown source_type: ${sourceType}`);
}
