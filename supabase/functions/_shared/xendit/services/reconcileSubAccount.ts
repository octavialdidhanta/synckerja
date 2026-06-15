import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequestProbe } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";

type XenditAccountResponse = {
  id?: string;
  user_id?: string;
  status?: string;
};

function mapXenditAccountStatus(status: string | undefined): string {
  const apiStatus = String(status ?? "").trim().toUpperCase();
  if (apiStatus === "LIVE" || apiStatus === "REGISTERED" || apiStatus === "ACTIVE") return "active";
  if (apiStatus === "SUSPENDED") return "suspended";
  if (apiStatus === "FAILED") return "failed";
  return "pending";
}

function isXenditAccountNotFound(status: number, body: unknown): boolean {
  if (status === 404) return true;
  if (!body || typeof body !== "object") return false;
  const row = body as Record<string, unknown>;
  const code = String(row.error_code ?? "").toUpperCase();
  const message = String(row.message ?? "").toLowerCase();
  return code.includes("NOT_FOUND") || code === "DATA_NOT_FOUND" || message.includes("not found");
}

/** Sync local organization_xendit_accounts with Xendit xenPlatform (detect dashboard deletions). */
export async function reconcileOrgXenditSubAccount(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  accountRow: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!accountRow) return null;

  const subId = String(accountRow.xendit_sub_account_id ?? "").trim();
  if (!subId) return accountRow;

  const probe = await xenditRequestProbe(env.secretKey, {
    method: "GET",
    path: `/v2/accounts/${encodeURIComponent(subId)}`,
  });

  if (probe.ok) {
    const body = probe.body as XenditAccountResponse;
    const mappedStatus = mapXenditAccountStatus(body.status);
    if (mappedStatus !== String(accountRow.status ?? "")) {
      const { data: updated, error } = await admin
        .from("organization_xendit_accounts")
        .update({
          status: mappedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .select("*")
        .single();
      if (!error && updated) return updated as Record<string, unknown>;
    }
    return accountRow;
  }

  if (!isXenditAccountNotFound(probe.status, probe.body)) {
    // Transient / permission errors: keep cached row; do not wipe on API blips.
    return accountRow;
  }

  const prevMeta =
    accountRow.metadata && typeof accountRow.metadata === "object"
      ? (accountRow.metadata as Record<string, unknown>)
      : {};

  const { data: cleared, error } = await admin
    .from("organization_xendit_accounts")
    .update({
      xendit_sub_account_id: null,
      status: "pending",
      metadata: {
        ...prevMeta,
        sub_account_removed_at: new Date().toISOString(),
        removed_sub_account_id: subId,
        reconcile_note: "Sub-account removed on Xendit xenPlatform; local link cleared",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return (cleared ?? accountRow) as Record<string, unknown>;
}
