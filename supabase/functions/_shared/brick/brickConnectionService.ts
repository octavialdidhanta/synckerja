import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptBrickToken } from "./brickConfigCrypto.ts";
import {
  fetchBrickAccountBalance,
  listBrickAggregatedAccounts,
  pickBestAggregatedAccount,
  type BrickAggregatedAccount,
} from "./aggregationApi.ts";

export type BrickOAuthTargetType = "bank_account" | "debt";

export async function completeBrickOAuthLink(
  admin: SupabaseClient,
  params: {
    organizationId: string;
    userId: string;
    targetType: BrickOAuthTargetType;
    targetId: string;
    userAccessToken: string;
    refreshToken?: string | null;
    brickUserId?: string | null;
    rawPayload?: Record<string, unknown> | null;
  },
): Promise<{ ok: true; connectionId: string; account: BrickAggregatedAccount } | { ok: false; error: string }> {
  const {
    organizationId,
    userId,
    targetType,
    targetId,
    userAccessToken,
    refreshToken,
    brickUserId,
    rawPayload,
  } = params;

  let accountNumber: string | null = null;
  let bankName: string | null = null;
  let debtName: string | null = null;

  if (targetType === "bank_account") {
    const { data: bank, error } = await admin
      .from("bank_accounts")
      .select("id, account_number, bank_name, organization_id")
      .eq("id", targetId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error || !bank) return { ok: false, error: "Bank account not found" };
    accountNumber = bank.account_number ? String(bank.account_number) : null;
    bankName = bank.bank_name ? String(bank.bank_name) : null;

    await admin
      .from("bank_accounts")
      .update({ brick_link_status: "pending", brick_last_sync_error: null })
      .eq("id", targetId);
  } else {
    const { data: debt, error } = await admin
      .from("debts")
      .select("id, debt_name, bank_name, debt_type, organization_id")
      .eq("id", targetId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error || !debt) return { ok: false, error: "Debt not found" };
    if (String(debt.debt_type) !== "Kartu Kredit") {
      return { ok: false, error: "Brick link is only supported for Kartu Kredit debts" };
    }
    debtName = debt.debt_name ? String(debt.debt_name) : null;
    bankName = debt.bank_name ? String(debt.bank_name) : null;

    await admin
      .from("debts")
      .update({ brick_link_status: "pending", brick_last_sync_error: null })
      .eq("id", targetId);
  }

  let accessEnc: string;
  let refreshEnc: string | null = null;
  try {
    accessEnc = await encryptBrickToken(userAccessToken);
    if (refreshToken) refreshEnc = await encryptBrickToken(refreshToken);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "encryption_failed";
    await markTargetError(admin, targetType, targetId, msg);
    return { ok: false, error: msg };
  }

  let accounts: BrickAggregatedAccount[];
  try {
    accounts = await listBrickAggregatedAccounts(userAccessToken, {
      targetType,
      accountNumber,
      bankName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "list_accounts_failed";
    await markTargetError(admin, targetType, targetId, msg);
    return { ok: false, error: msg };
  }

  const picked = pickBestAggregatedAccount(accounts, targetType, {
    accountNumber,
    bankName,
    debtName,
  });
  if (!picked) {
    const msg = "No matching Brick account found for this target";
    await markTargetError(admin, targetType, targetId, msg);
    return { ok: false, error: msg };
  }

  const now = new Date().toISOString();
  const { data: connection, error: connErr } = await admin
    .from("brick_financial_connections")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      brick_user_id: brickUserId ?? null,
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      institution_id: picked.institutionId,
      institution_name: picked.institutionName,
      status: "active",
      linked_at: now,
      raw_payload: rawPayload ?? null,
      updated_at: now,
    })
    .select("id")
    .single();

  if (connErr || !connection?.id) {
    const msg = connErr?.message ?? "save_connection_failed";
    await markTargetError(admin, targetType, targetId, msg);
    return { ok: false, error: msg };
  }

  const connectionId = String(connection.id);

  if (targetType === "bank_account") {
    const balance = picked.balance ?? await fetchBrickAccountBalance(userAccessToken, picked.accountId);
    const { error: updErr } = await admin
      .from("bank_accounts")
      .update({
        brick_connection_id: connectionId,
        brick_aggregated_account_id: picked.accountId,
        brick_link_status: "linked",
        brick_link_mode: "aggregation_oauth",
        brick_account_id: null,
        brick_last_sync_error: null,
        bank_statement_balance: balance,
        updated_at: now,
      })
      .eq("id", targetId);
    if (updErr) return { ok: false, error: updErr.message };
  } else {
    const { error: updErr } = await admin
      .from("debts")
      .update({
        brick_connection_id: connectionId,
        brick_aggregated_account_id: picked.accountId,
        brick_link_status: "linked",
        brick_last_sync_error: null,
        updated_at: now,
      })
      .eq("id", targetId);
    if (updErr) return { ok: false, error: updErr.message };
  }

  return { ok: true, connectionId, account: picked };
}

async function markTargetError(
  admin: SupabaseClient,
  targetType: BrickOAuthTargetType,
  targetId: string,
  message: string,
): Promise<void> {
  const payload = {
    brick_link_status: "error",
    brick_last_sync_error: message,
    updated_at: new Date().toISOString(),
  };
  if (targetType === "bank_account") {
    await admin.from("bank_accounts").update(payload).eq("id", targetId);
  } else {
    await admin.from("debts").update(payload).eq("id", targetId);
  }
}

export async function unlinkBrickTarget(
  admin: SupabaseClient,
  params: {
    organizationId: string;
    targetType: BrickOAuthTargetType;
    targetId: string;
  },
): Promise<void> {
  const { organizationId, targetType, targetId } = params;

  if (targetType === "bank_account") {
    const { data } = await admin
      .from("bank_accounts")
      .select("brick_connection_id")
      .eq("id", targetId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    await admin
      .from("bank_accounts")
      .update({
        brick_connection_id: null,
        brick_aggregated_account_id: null,
        brick_account_id: null,
        brick_link_status: "unlinked",
        brick_last_sync_error: null,
        bank_statement_balance: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId)
      .eq("organization_id", organizationId);

    const connId = data?.brick_connection_id ? String(data.brick_connection_id) : null;
    if (connId) {
      await admin
        .from("brick_financial_connections")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", connId);
    }
    return;
  }

  const { data } = await admin
    .from("debts")
    .select("brick_connection_id")
    .eq("id", targetId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  await admin
    .from("debts")
    .update({
      brick_connection_id: null,
      brick_aggregated_account_id: null,
      brick_link_status: "unlinked",
      brick_last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetId)
    .eq("organization_id", organizationId);

  const connId = data?.brick_connection_id ? String(data.brick_connection_id) : null;
  if (connId) {
    await admin
      .from("brick_financial_connections")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", connId);
  }
}
