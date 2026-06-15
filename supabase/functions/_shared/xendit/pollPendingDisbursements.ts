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

export async function pollPendingXenditDisbursements(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
): Promise<{ polled: number; completed: number; errors: string[] }> {
  const { data: account } = await admin
    .from("organization_xendit_accounts")
    .select("xendit_sub_account_id, is_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!account?.is_enabled || !account.xendit_sub_account_id) {
    return { polled: 0, completed: 0, errors: [] };
  }

  const subAccountId = String(account.xendit_sub_account_id);

  const { data: pending, error } = await admin
    .from("xendit_disbursements")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "processing"]);

  if (error) {
    return { polled: 0, completed: 0, errors: [error.message] };
  }

  let polled = 0;
  let completed = 0;
  const errors: string[] = [];

  for (const row of pending ?? []) {
    try {
      polled += 1;
      const apiRes = await fetchXenditDisbursementStatus(env, subAccountId, row as Record<string, unknown>);
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

  return { polled, completed, errors };
}
