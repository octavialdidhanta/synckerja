import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "./xenditClient.ts";
import type { XenditEnvConfig } from "./xenditEnv.ts";
import { handleDisbursementWebhook } from "./webhooks/handleDisbursement.ts";

type XenditDisbursementApiRow = {
  id?: string;
  external_id?: string;
  status?: string;
  failure_code?: string;
  failure_reason?: string;
  description?: string;
};

async function fetchXenditDisbursementStatus(
  env: XenditEnvConfig,
  subAccountId: string,
  row: Record<string, unknown>,
): Promise<XenditDisbursementApiRow> {
  const xenditId = row.xendit_disbursement_id ? String(row.xendit_disbursement_id) : "";
  const externalId = row.external_id ? String(row.external_id) : "";

  if (xenditId) {
    return xenditRequest<XenditDisbursementApiRow>(env.secretKey, {
      path: `/disbursements/${encodeURIComponent(xenditId)}`,
      forUserId: subAccountId,
    });
  }

  if (externalId) {
    const list = await xenditRequest<XenditDisbursementApiRow[]>(env.secretKey, {
      path: `/disbursements?external_id=${encodeURIComponent(externalId)}`,
      forUserId: subAccountId,
    });
    if (Array.isArray(list) && list.length > 0) return list[0];
    const single = await xenditRequest<XenditDisbursementApiRow>(env.secretKey, {
      path: `/disbursements?external_id=${encodeURIComponent(externalId)}`,
      forUserId: subAccountId,
    });
    return single;
  }

  throw new Error("Missing xendit_disbursement_id and external_id");
}

/** Payroll calcs left in processing after Xendit already completed (legacy batch overwrite bug). */
async function reconcileStuckPayrollDisbursements(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
): Promise<number> {
  const { data: terminalRows, error } = await admin
    .from("xendit_disbursements")
    .select("id, external_id, xendit_disbursement_id, status, source_id, failure_code, failure_message")
    .eq("organization_id", organizationId)
    .eq("source_type", "payroll_calculation")
    .in("status", ["completed", "failed"]);

  if (error) {
    console.error("reconcileStuckPayrollDisbursements:", error.message);
    return 0;
  }

  let reconciled = 0;

  for (const row of terminalRows ?? []) {
    const sourceId = String(row.source_id ?? "");
    if (!sourceId) continue;

    const { data: calc } = await admin
      .from("employee_payroll_calculations")
      .select("id, payment_status")
      .eq("id", sourceId)
      .eq("payment_status", "processing")
      .maybeSingle();

    if (!calc) continue;

    const xenditStatus = String(row.status ?? "");
    await handleDisbursementWebhook(admin, env, {
      external_id: String(row.external_id ?? ""),
      status: xenditStatus === "completed" ? "COMPLETED" : "FAILED",
      id: row.xendit_disbursement_id,
      failure_code: row.failure_code,
      failure_reason: row.failure_message,
    });
    reconciled += 1;
  }

  return reconciled;
}

export async function pollPendingXenditDisbursements(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
): Promise<{ polled: number; completed: number; reconciled: number; errors: string[] }> {
  const { data: settings } = await admin
    .from("organization_xendit_settings")
    .select("is_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const { data: account } = await admin
    .from("xendit_sub_accounts")
    .select("xendit_sub_account_id")
    .eq("organization_id", organizationId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!settings?.is_enabled || !account?.xendit_sub_account_id) {
    return { polled: 0, completed: 0, reconciled: 0, errors: [] };
  }

  let reconciled = 0;
  try {
    reconciled = await reconcileStuckPayrollDisbursements(admin, env, organizationId);
  } catch (e) {
    console.error("reconcileStuckPayrollDisbursements:", e);
  }

  const { data: pending, error } = await admin
    .from("xendit_disbursements")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "processing"]);

  if (error) {
    return { polled: 0, completed: 0, reconciled, errors: [error.message] };
  }

  let polled = 0;
  let completed = 0;
  const errors: string[] = [];

  const primarySubAccountId = String(account.xendit_sub_account_id);

  for (const row of pending ?? []) {
    const rowSubAccountId = String(row.sub_account_id ?? "").trim() || primarySubAccountId;
    try {
      polled += 1;
      const apiRes = await fetchXenditDisbursementStatus(env, rowSubAccountId, row as Record<string, unknown>);
      const status = String(apiRes.status ?? "").toUpperCase();
      const isTerminal = status === "COMPLETED" || status === "SUCCEEDED" || status === "FAILED";

      if (!isTerminal) continue;

      const beforeStatus = String(row.status ?? "");
      await handleDisbursementWebhook(admin, env, {
        external_id: String(apiRes.external_id ?? row.external_id ?? ""),
        status: apiRes.status,
        id: apiRes.id ?? row.xendit_disbursement_id,
        failure_code: apiRes.failure_code,
        failure_reason: apiRes.failure_reason,
        description: apiRes.description,
      });

      if (
        (status === "COMPLETED" || status === "SUCCEEDED") &&
        beforeStatus !== "completed"
      ) {
        completed += 1;
      }
    } catch (e) {
      const ref = String(row.external_id ?? row.id ?? "unknown");
      errors.push(`${ref}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { polled, completed, reconciled, errors };
}
