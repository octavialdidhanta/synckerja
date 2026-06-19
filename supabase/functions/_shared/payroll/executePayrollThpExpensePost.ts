import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computePayrollRunThpTotal } from "./computePayrollRunThpTotal.ts";
import type {
  PayrollExpenseSettingsRow,
  PayrollThpExpensePostResult,
} from "./payrollExpenseTypes.ts";

async function logExpenseAudit(
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
  if (error) console.error("logExpenseAudit:", error.message);
}

async function loadExpenseSettings(
  admin: SupabaseClient,
  organizationId: string,
): Promise<PayrollExpenseSettingsRow | null> {
  const { data, error } = await admin
    .from("organization_payroll_expense_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PayrollExpenseSettingsRow | null) ?? null;
}

export async function executePayrollThpExpensePost(
  admin: SupabaseClient,
  runId: string,
  options: { actorUserId?: string | null } = {},
): Promise<PayrollThpExpensePostResult> {
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
  const actorUserId = options.actorUserId ?? null;
  const settings = await loadExpenseSettings(admin, orgId);
  if (!settings?.is_enabled) {
    await logExpenseAudit(
      admin,
      orgId,
      runId,
      "payroll_expense_post_skipped",
      { reason: "expense_post_disabled" },
      actorUserId,
    );
    return { ok: true, skipped: true, reason: "expense_post_disabled" };
  }

  const { data: existing } = await admin
    .from("expenses")
    .select("id, amount")
    .eq("payroll_run_id", runId)
    .maybeSingle();
  if (existing?.id) {
    return {
      ok: true,
      expense_id: String(existing.id),
      amount: Number(existing.amount) || 0,
      skipped: true,
      reason: "already_posted",
    };
  }

  const thp = await computePayrollRunThpTotal(admin, runId);
  if (thp.amount <= 0) {
    await logExpenseAudit(
      admin,
      orgId,
      runId,
      "payroll_expense_post_skipped",
      { reason: "amount_zero", employee_count: thp.employee_count },
      actorUserId,
    );
    return { ok: true, skipped: true, reason: "amount_zero", amount: 0 };
  }

  const { data: rpcData, error: rpcErr } = await admin.rpc("finalize_payroll_run_thp_expense", {
    p_run_id: runId,
    p_actor_user_id: actorUserId,
  });
  if (rpcErr) throw new Error(rpcErr.message);

  const result = (rpcData ?? {}) as Record<string, unknown>;
  if (result.ok !== true) {
    const reason = String(result.reason ?? "unknown");
    if (reason === "missing_expense_type" || reason === "missing_expense_category") {
      await logExpenseAudit(admin, orgId, runId, "payroll_expense_post_failed", result, actorUserId);
      return { ok: false, reason, error: reason };
    }
    if (result.skipped === true) {
      await logExpenseAudit(
        admin,
        orgId,
        runId,
        "payroll_expense_post_skipped",
        result,
        actorUserId,
      );
      return {
        ok: true,
        skipped: true,
        reason,
        amount: Number(result.amount) || undefined,
      };
    }
    return { ok: false, reason, error: reason };
  }

  if (result.skipped === true) {
    return {
      ok: true,
      expense_id: result.expense_id != null ? String(result.expense_id) : undefined,
      skipped: true,
      reason: result.reason != null ? String(result.reason) : undefined,
      amount: Number(result.amount) || undefined,
    };
  }

  await logExpenseAudit(
    admin,
    orgId,
    runId,
    "payroll_expense_posted",
    {
      expense_id: result.expense_id,
      amount: result.amount,
      employee_count: result.employee_count,
    },
    actorUserId,
  );

  return {
    ok: true,
    expense_id: result.expense_id != null ? String(result.expense_id) : undefined,
    amount: Number(result.amount) || thp.amount,
    employee_count: Number(result.employee_count) || thp.employee_count,
  };
}

export async function maybePostPayrollThpExpense(
  admin: SupabaseClient,
  runId: string,
  actorUserId?: string | null,
): Promise<PayrollThpExpensePostResult> {
  try {
    return await executePayrollThpExpensePost(admin, runId, { actorUserId });
  } catch (e) {
    console.error("maybePostPayrollThpExpense:", e);
    return { ok: false, error: e instanceof Error ? e.message : "THP expense post failed" };
  }
}

export async function getPayrollExpenseSettingsForOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<PayrollExpenseSettingsRow | null> {
  return loadExpenseSettings(admin, organizationId);
}

export async function updatePayrollExpenseSettingsForOrg(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  patch: {
    is_enabled?: boolean;
    expense_type_name?: string;
    expense_category_name?: string;
    department?: string;
  },
): Promise<PayrollExpenseSettingsRow> {
  const existing = await loadExpenseSettings(admin, organizationId);
  const payload = {
    organization_id: organizationId,
    is_enabled: patch.is_enabled !== undefined ? patch.is_enabled : existing?.is_enabled ?? false,
    expense_type_name:
      patch.expense_type_name !== undefined
        ? patch.expense_type_name
        : existing?.expense_type_name ?? "Fixed Expenses",
    expense_category_name:
      patch.expense_category_name !== undefined
        ? patch.expense_category_name
        : existing?.expense_category_name ?? "Gaji Karyawan Tetap",
    department:
      patch.department !== undefined ? patch.department : existing?.department ?? "Finance",
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const { data, error } = await admin
    .from("organization_payroll_expense_settings")
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PayrollExpenseSettingsRow;
}
