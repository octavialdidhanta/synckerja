import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequestProbe } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { mapXenditAccountStatus } from "./createSubAccount.ts";

type XenditAccountResponse = {
  id?: string;
  user_id?: string;
  status?: string;
  kyc_status?: string;
};

function isXenditAccountNotFound(status: number, body: unknown): boolean {
  if (status === 404) return true;
  if (!body || typeof body !== "object") return false;
  const row = body as Record<string, unknown>;
  const code = String(row.error_code ?? "").toUpperCase();
  const message = String(row.message ?? "").toLowerCase();
  return code.includes("NOT_FOUND") || code === "DATA_NOT_FOUND" || message.includes("not found");
}

/** Sync a single xendit_sub_accounts row with Xendit xenPlatform API. */
export async function reconcileXenditSubAccountRow(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  accountRow: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!accountRow) return null;

  const rowId = String(accountRow.id ?? "").trim();
  const subId = String(accountRow.xendit_sub_account_id ?? "").trim();
  if (!subId || !rowId) return accountRow;

  const probe = await xenditRequestProbe(env.secretKey, {
    method: "GET",
    path: `/v2/accounts/${encodeURIComponent(subId)}`,
  });

  if (probe.ok) {
    const body = probe.body as XenditAccountResponse;
    const mappedStatus = mapXenditAccountStatus(body.status);
    const kycStatus = body.kyc_status ? String(body.kyc_status) : null;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let changed = false;

    if (mappedStatus !== String(accountRow.status ?? "")) {
      updates.status = mappedStatus;
      changed = true;
    }
    if (kycStatus && kycStatus !== String(accountRow.kyc_status ?? "")) {
      updates.kyc_status = kycStatus;
      changed = true;
    }

    if (changed) {
      const { data: updated, error } = await admin
        .from("xendit_sub_accounts")
        .update(updates)
        .eq("id", rowId)
        .eq("organization_id", organizationId)
        .select("*")
        .single();
      if (!error && updated) return updated as Record<string, unknown>;
    }
    return accountRow;
  }

  if (!isXenditAccountNotFound(probe.status, probe.body)) {
    return accountRow;
  }

  const prevMeta =
    accountRow.metadata && typeof accountRow.metadata === "object"
      ? (accountRow.metadata as Record<string, unknown>)
      : {};

  const { data: cleared, error } = await admin
    .from("xendit_sub_accounts")
    .update({
      xendit_sub_account_id: null,
      status: "failed",
      metadata: {
        ...prevMeta,
        sub_account_removed_at: new Date().toISOString(),
        removed_sub_account_id: subId,
        reconcile_note: "Sub-account removed on Xendit xenPlatform; local link cleared",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return (cleared ?? accountRow) as Record<string, unknown>;
}

/** @deprecated Use reconcileXenditSubAccountRow */
export async function reconcileOrgXenditSubAccount(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  accountRow: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!accountRow) return null;
  const rowId = String(accountRow.id ?? "").trim();
  if (rowId) {
    return reconcileXenditSubAccountRow(admin, env, organizationId, accountRow);
  }
  const subId = String(accountRow.xendit_sub_account_id ?? "").trim();
  if (!subId) return accountRow;
  const { data } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("xendit_sub_account_id", subId)
    .maybeSingle();
  if (!data) return accountRow;
  return reconcileXenditSubAccountRow(admin, env, organizationId, data as Record<string, unknown>);
}

export async function reconcileOrgSubAccounts(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const reconciled: Record<string, unknown>[] = [];
  for (const row of rows) {
    reconciled.push(
      (await reconcileXenditSubAccountRow(admin, env, organizationId, row)) ?? row,
    );
  }
  return reconciled;
}
