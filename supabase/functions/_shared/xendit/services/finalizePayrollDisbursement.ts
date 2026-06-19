import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { notifyPayrollCalcPaid } from "../../payroll/notifyPayrollCalcPaid.ts";
import { syncAllOrgXenditWallets } from "./getBalance.ts";
import { maybeTransferPayrollEscrow } from "./executePayrollEscrowTransfer.ts";
import { maybePostPayrollThpExpense } from "../../payroll/executePayrollThpExpensePost.ts";

export async function maybeFinalizePayrollRun(
  admin: SupabaseClient,
  runId: string,
): Promise<{ finalized: boolean; alreadyPaid?: boolean }> {
  const { data, error } = await admin.rpc("maybe_finalize_payroll_run", { p_run_id: runId });
  if (error) {
    console.error("maybe_finalize_payroll_run:", error.message);
    return { finalized: false };
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    finalized: Boolean(row.finalized),
    alreadyPaid: Boolean(row.already_paid),
  };
}

export async function syncOrgXenditWalletAfterPayroll(
  admin: SupabaseClient,
  organizationId: string,
  env: XenditEnvConfig,
): Promise<void> {
  try {
    await syncAllOrgXenditWallets(admin, organizationId, env);
  } catch (e) {
    console.error("syncOrgXenditWalletAfterPayroll:", e);
  }
}

export async function logPayrollXenditDisburseBatch(
  admin: SupabaseClient,
  organizationId: string,
  runId: string,
  userId: string,
  meta: { processed: number; failed: number; total_thp: number },
): Promise<void> {
  const { error } = await admin.from("payroll_audit_log").insert({
    organization_id: organizationId,
    payroll_run_id: runId,
    employee_calculation_id: null,
    action: "xendit_disburse_batch",
    actor_user_id: userId,
    metadata: meta,
  });
  if (error) console.error("logPayrollXenditDisburseBatch:", error.message);
}

export async function afterPayrollCalcTerminalUpdate(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  calculationId: string,
  options: { syncWallet?: boolean; notifyPaid?: boolean; actorUserId?: string | null } = {},
): Promise<void> {
  const { data: calc } = await admin
    .from("employee_payroll_calculations")
    .select("payroll_run_id, organization_id, payment_status")
    .eq("id", calculationId)
    .maybeSingle();
  if (!calc?.payroll_run_id) return;

  if (options.notifyPaid && calc.payment_status === "paid") {
    try {
      await notifyPayrollCalcPaid(admin, calculationId);
    } catch (e) {
      console.error("notifyPayrollCalcPaid:", e);
    }
  }

  const finalizeResult = await maybeFinalizePayrollRun(admin, String(calc.payroll_run_id));

  if (finalizeResult.finalized) {
    const runId = String(calc.payroll_run_id);
    await maybeTransferPayrollEscrow(admin, env, runId, options.actorUserId ?? null);
    await maybePostPayrollThpExpense(admin, runId, options.actorUserId ?? null);
  }

  if (options.syncWallet && calc.organization_id) {
    await syncOrgXenditWalletAfterPayroll(admin, String(calc.organization_id), env);
  }
}
