import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import {
  buildEscrowTransferReference,
  parseStatutoryEscrowAmounts,
} from "../../payroll/computeStatutoryEscrowAmounts.ts";
import type {
  PayrollEscrowSettingsRow,
  PayrollEscrowTransferResult,
} from "../../payroll/payrollEscrowTypes.ts";
import { createXenditTransfer } from "./createXenditTransfer.ts";
import { fetchXenditWalletBalance, syncAllOrgXenditWallets } from "./getBalance.ts";
import {
  getPrimarySubAccount,
  getSubAccountById,
  resolvePrimarySubAccount,
} from "./resolveSubAccount.ts";

async function logEscrowAudit(
  admin: SupabaseClient,
  orgId: string,
  runId: string,
  action: string,
  metadata: Record<string, unknown>,
  actorUserId: string | null,
): Promise<void> {
  const { error } = await admin.from("payroll_audit_log").insert({
    organization_id: orgId,
    payroll_run_id: runId,
    employee_calculation_id: null,
    action,
    actor_user_id: actorUserId,
    metadata,
  });
  if (error) console.error("logEscrowAudit:", error.message);
}

async function loadEscrowSettings(
  admin: SupabaseClient,
  organizationId: string,
): Promise<PayrollEscrowSettingsRow | null> {
  const { data, error } = await admin
    .from("organization_payroll_escrow_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PayrollEscrowSettingsRow | null) ?? null;
}

export async function executePayrollEscrowTransfer(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  runId: string,
  options: { actorUserId?: string | null; forceRetry?: boolean } = {},
): Promise<PayrollEscrowTransferResult> {
  const { data: run, error: runErr } = await admin
    .from("payroll_runs")
    .select("id, organization_id, status")
    .eq("id", runId)
    .maybeSingle();
  if (runErr) throw new Error(runErr.message);
  if (!run?.id) return { ok: false, error: "Payroll run not found" };
  if (String(run.status) !== "paid") {
    return { ok: true, skipped: true, reason: "run_not_paid" };
  }

  const orgId = String(run.organization_id);
  const settings = await loadEscrowSettings(admin, orgId);
  if (!settings?.is_enabled) {
    return { ok: true, skipped: true, reason: "escrow_disabled" };
  }
  if (!settings.escrow_sub_account_row_id) {
    return { ok: true, skipped: true, reason: "escrow_sub_account_not_configured" };
  }

  const { data: existing } = await admin
    .from("payroll_xendit_escrow_transfers")
    .select("*")
    .eq("payroll_run_id", runId)
    .maybeSingle();

  if (existing?.status === "completed" && !options.forceRetry) {
    return { ok: true, skipped: true, reason: "already_completed", transfer: existing as never };
  }
  if (existing?.status === "pending" && !options.forceRetry) {
    return { ok: true, skipped: true, reason: "already_pending", transfer: existing as never };
  }

  const { data: amountsRaw, error: amountsErr } = await admin.rpc(
    "get_payroll_statutory_escrow_amounts",
    { p_run_id: runId },
  );
  if (amountsErr) throw new Error(amountsErr.message);
  const amounts = parseStatutoryEscrowAmounts(amountsRaw);

  if (!amounts.success || amounts.amount_total <= 0) {
    await logEscrowAudit(admin, orgId, runId, "payroll_escrow_transfer_skipped", {
      reason: "zero_amount",
      amounts,
    }, options.actorUserId ?? null);
    return { ok: true, skipped: true, reason: "zero_amount" };
  }

  const primary = await resolvePrimarySubAccount(admin, env, orgId);
  const escrowRow = await getSubAccountById(admin, orgId, settings.escrow_sub_account_row_id);
  if (!escrowRow?.xendit_sub_account_id) {
    return { ok: false, error: "Escrow sub-account not found or missing Xendit ID" };
  }
  if (String(escrowRow.id) === String(primary.accountRow.id)) {
    return { ok: false, error: "Escrow sub-account cannot be the primary sub-account" };
  }
  if (String(escrowRow.status ?? "").toLowerCase() !== "active") {
    return { ok: false, error: "Escrow sub-account is not active" };
  }

  const reference = buildEscrowTransferReference(orgId, runId);
  const transferAmount = Math.floor(amounts.amount_total);

  await syncAllOrgXenditWallets(admin, orgId, env);
  const primaryBalance = await fetchXenditWalletBalance(env, primary.subAccountId);
  if (primaryBalance.usableBalance < transferAmount) {
    const failedRow = {
      organization_id: orgId,
      payroll_run_id: runId,
      source_sub_account_row_id: String(primary.accountRow.id),
      dest_sub_account_row_id: String(escrowRow.id),
      amount_pph21: amounts.amount_pph21,
      amount_bpjs_kesehatan: amounts.amount_bpjs_kesehatan,
      amount_bpjs_pensiun: amounts.amount_bpjs_pensiun,
      amount_total: transferAmount,
      reference,
      status: "failed",
      failure_code: "INSUFFICIENT_CASH",
      failure_message: `Primary CASH ${primaryBalance.usableBalance} < required ${transferAmount}`,
      initiated_by: options.actorUserId ?? null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id && options.forceRetry) {
      await admin.from("payroll_xendit_escrow_transfers").update(failedRow).eq("id", existing.id);
    } else if (!existing?.id) {
      await admin.from("payroll_xendit_escrow_transfers").insert(failedRow);
    } else {
      await admin.from("payroll_xendit_escrow_transfers").update(failedRow).eq("id", existing.id);
    }

    await logEscrowAudit(admin, orgId, runId, "payroll_escrow_transfer_failed", {
      reason: "insufficient_cash",
      required: transferAmount,
      available: primaryBalance.usableBalance,
      amounts,
    }, options.actorUserId ?? null);

    return { ok: false, error: failedRow.failure_message ?? "Insufficient primary CASH balance" };
  }

  const pendingPayload = {
    organization_id: orgId,
    payroll_run_id: runId,
    source_sub_account_row_id: String(primary.accountRow.id),
    dest_sub_account_row_id: String(escrowRow.id),
    amount_pph21: amounts.amount_pph21,
    amount_bpjs_kesehatan: amounts.amount_bpjs_kesehatan,
    amount_bpjs_pensiun: amounts.amount_bpjs_pensiun,
    amount_total: transferAmount,
    reference,
    status: "pending",
    failure_code: null,
    failure_message: null,
    initiated_by: options.actorUserId ?? null,
    updated_at: new Date().toISOString(),
  };

  let transferRowId = existing?.id ? String(existing.id) : null;
  if (transferRowId) {
    await admin.from("payroll_xendit_escrow_transfers").update(pendingPayload).eq("id", transferRowId);
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("payroll_xendit_escrow_transfers")
      .insert(pendingPayload)
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);
    transferRowId = String(inserted.id);
  }

  try {
    const result = await createXenditTransfer(env, {
      reference,
      amount: transferAmount,
      sourceUserId: primary.subAccountId,
      destinationUserId: String(escrowRow.xendit_sub_account_id),
    });

    const terminalStatus = result.status === "completed" ? "completed" : result.status === "failed" ? "failed" : "pending";
    const updatePayload = {
      status: terminalStatus,
      xendit_transfer_id: result.transferId,
      failure_code: terminalStatus === "failed" ? result.raw.error_code ?? "TRANSFER_FAILED" : null,
      failure_message: terminalStatus === "failed" ? result.raw.message ?? "Transfer failed" : null,
      completed_at: terminalStatus === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updErr } = await admin
      .from("payroll_xendit_escrow_transfers")
      .update(updatePayload)
      .eq("id", transferRowId)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);

    if (terminalStatus === "completed") {
      await logEscrowAudit(admin, orgId, runId, "payroll_escrow_transfer", {
        reference,
        transfer_id: result.transferId,
        amounts,
      }, options.actorUserId ?? null);
      await syncAllOrgXenditWallets(admin, orgId, env);
      return { ok: true, transfer: updated as never };
    }

    if (terminalStatus === "failed") {
      await logEscrowAudit(admin, orgId, runId, "payroll_escrow_transfer_failed", {
        reference,
        raw: result.raw,
        amounts,
      }, options.actorUserId ?? null);
      return { ok: false, error: updatePayload.failure_message ?? "Transfer failed", transfer: updated as never };
    }

    return { ok: true, transfer: updated as never };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transfer request failed";
    await admin
      .from("payroll_xendit_escrow_transfers")
      .update({
        status: "failed",
        failure_code: "TRANSFER_ERROR",
        failure_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transferRowId);

    await logEscrowAudit(admin, orgId, runId, "payroll_escrow_transfer_failed", {
      reference,
      error: message,
      amounts,
    }, options.actorUserId ?? null);

    return { ok: false, error: message };
  }
}

export async function maybeTransferPayrollEscrow(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  runId: string,
  actorUserId?: string | null,
): Promise<PayrollEscrowTransferResult> {
  try {
    return await executePayrollEscrowTransfer(admin, env, runId, { actorUserId });
  } catch (e) {
    console.error("maybeTransferPayrollEscrow:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Escrow transfer failed" };
  }
}

export async function getPayrollEscrowSettingsForOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<PayrollEscrowSettingsRow | null> {
  return loadEscrowSettings(admin, organizationId);
}

export async function updatePayrollEscrowSettingsForOrg(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  patch: {
    is_enabled?: boolean;
    escrow_sub_account_row_id?: string | null;
    require_xendit_disburse?: boolean;
  },
): Promise<PayrollEscrowSettingsRow> {
  const existing = await loadEscrowSettings(admin, organizationId);
  const nextEscrowId =
    patch.escrow_sub_account_row_id !== undefined
      ? patch.escrow_sub_account_row_id
      : existing?.escrow_sub_account_row_id ?? null;

  if (nextEscrowId) {
    const escrowRow = await getSubAccountById(admin, organizationId, nextEscrowId);
    if (!escrowRow) throw new Error("Escrow sub-account not found");
    if (escrowRow.is_primary) throw new Error("Escrow sub-account cannot be primary");
    if (String(escrowRow.status ?? "").toLowerCase() !== "active") {
      throw new Error("Escrow sub-account must be active");
    }
  }

  const isEnabled = patch.is_enabled !== undefined ? patch.is_enabled : existing?.is_enabled ?? false;
  if (isEnabled && !nextEscrowId) {
    throw new Error("Select an escrow sub-account before enabling payroll escrow");
  }

  const payload = {
    organization_id: organizationId,
    is_enabled: isEnabled,
    escrow_sub_account_row_id: nextEscrowId,
    require_xendit_disburse:
      patch.require_xendit_disburse !== undefined
        ? patch.require_xendit_disburse
        : existing?.require_xendit_disburse ?? true,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const { data, error } = await admin
    .from("organization_payroll_escrow_settings")
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PayrollEscrowSettingsRow;
}

export async function getPrimarySubAccountRowId(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const row = await getPrimarySubAccount(admin, organizationId);
  return row?.id ? String(row.id) : null;
}
