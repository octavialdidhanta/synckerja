import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { upsertGatewayWalletSnapshot } from "../../gatewayWalletSnapshot.ts";

export type XenditWalletBalance = {
  usableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  raw: Record<string, unknown>;
};

export type XenditSubAccountWalletRow = {
  id: string;
  organization_id: string;
  sub_account_row_id: string;
  xendit_sub_account_id: string;
  usable_balance: number;
  pending_balance: number;
  total_balance: number;
  currency: string;
  synced_at: string | null;
  sync_error: string | null;
  email?: string;
  business_name?: string;
  is_primary?: boolean;
  status?: string;
};

const SYNCABLE_STATUSES = new Set(["active", "pending"]);

export async function fetchXenditWalletBalance(
  env: XenditEnvConfig,
  subAccountId: string,
): Promise<XenditWalletBalance> {
  const cashRes = await xenditRequest<{ balance?: number }>(env.secretKey, {
    path: "/balance?account_type=CASH&currency=IDR",
    forUserId: subAccountId,
  });
  const usableBalance = Number(cashRes.balance ?? 0);

  let pendingBalance = 0;
  try {
    const holdingRes = await xenditRequest<{ balance?: number }>(env.secretKey, {
      path: "/balance?account_type=HOLDING&currency=IDR",
      forUserId: subAccountId,
    });
    pendingBalance = Number(holdingRes.balance ?? 0);
  } catch {
    pendingBalance = 0;
  }

  return {
    usableBalance,
    pendingBalance,
    totalBalance: usableBalance + pendingBalance,
    raw: { cash: cashRes, pendingBalance },
  };
}

async function upsertSubAccountWalletRow(
  admin: SupabaseClient,
  organizationId: string,
  subAccountRow: Record<string, unknown>,
  snapshot: {
    usable_balance: number;
    pending_balance: number;
    total_balance: number;
    sync_error: string | null;
    raw_payload: Record<string, unknown> | null;
  },
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const row = {
    organization_id: organizationId,
    sub_account_row_id: String(subAccountRow.id),
    xendit_sub_account_id: String(subAccountRow.xendit_sub_account_id),
    usable_balance: snapshot.usable_balance,
    pending_balance: snapshot.pending_balance,
    total_balance: snapshot.total_balance,
    currency: "IDR",
    synced_at: snapshot.sync_error ? null : now,
    sync_error: snapshot.sync_error,
    raw_payload: snapshot.raw_payload,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("xendit_sub_account_wallets")
    .upsert(row, { onConflict: "sub_account_row_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function syncSubAccountWalletBalance(
  admin: SupabaseClient,
  organizationId: string,
  env: XenditEnvConfig,
  subAccountRow: Record<string, unknown>,
): Promise<{ ok: boolean; row?: Record<string, unknown>; error?: string }> {
  const xenditId = String(subAccountRow.xendit_sub_account_id ?? "").trim();
  if (!xenditId) {
    return { ok: false, error: "Missing xendit_sub_account_id" };
  }

  try {
    const balance = await fetchXenditWalletBalance(env, xenditId);
    const row = await upsertSubAccountWalletRow(admin, organizationId, subAccountRow, {
      usable_balance: balance.usableBalance,
      pending_balance: balance.pendingBalance,
      total_balance: balance.totalBalance,
      sync_error: null,
      raw_payload: balance.raw,
    });
    return { ok: true, row };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Xendit wallet sync failed";
    const row = await upsertSubAccountWalletRow(admin, organizationId, subAccountRow, {
      usable_balance: 0,
      pending_balance: 0,
      total_balance: 0,
      sync_error: message,
      raw_payload: null,
    });
    return { ok: false, row, error: message };
  }
}

async function upsertAggregateFromSubWallets(
  admin: SupabaseClient,
  organizationId: string,
  activeSubAccountRowIds: Set<string>,
): Promise<Record<string, unknown>> {
  const { data: walletRows, error } = await admin
    .from("xendit_sub_account_wallets")
    .select("*")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  let usable = 0;
  let pending = 0;
  let total = 0;
  let latestSyncedAt: string | null = null;
  const errors: string[] = [];

  for (const w of walletRows ?? []) {
    if (!activeSubAccountRowIds.has(String(w.sub_account_row_id))) continue;
    if (w.sync_error) {
      errors.push(String(w.sync_error));
      continue;
    }
    usable += Number(w.usable_balance ?? 0);
    pending += Number(w.pending_balance ?? 0);
    total += Number(w.total_balance ?? 0);
    const synced = w.synced_at ? String(w.synced_at) : null;
    if (synced && (!latestSyncedAt || synced > latestSyncedAt)) {
      latestSyncedAt = synced;
    }
  }

  return upsertGatewayWalletSnapshot(admin, organizationId, "xendit", {
    usable_balance: usable,
    pending_balance: pending,
    total_balance: total,
    sync_error: errors.length > 0 ? errors[0] : null,
    raw_payload: {
      aggregate: true,
      sub_account_count: activeSubAccountRowIds.size,
      synced_at: latestSyncedAt,
    },
  });
}

export type XenditWalletSyncResult = {
  ok: boolean;
  usableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  syncedAt: string | null;
  error?: string;
  skipped?: boolean;
  reason?: string;
  subAccountWallets?: XenditSubAccountWalletRow[];
};

export async function syncAllOrgXenditWallets(
  admin: SupabaseClient,
  organizationId: string,
  env: XenditEnvConfig,
): Promise<XenditWalletSyncResult> {
  const { data: settings, error: settingsErr } = await admin
    .from("organization_xendit_settings")
    .select("is_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (settingsErr) {
    return {
      ok: false,
      usableBalance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      syncedAt: null,
      error: settingsErr.message,
    };
  }

  if (!settings?.is_enabled) {
    return {
      ok: true,
      usableBalance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      syncedAt: null,
      skipped: true,
      reason: "Xendit not enabled",
    };
  }

  const { data: subAccounts, error: subErr } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .not("xendit_sub_account_id", "is", null);

  if (subErr) {
    return {
      ok: false,
      usableBalance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      syncedAt: null,
      error: subErr.message,
    };
  }

  const syncable = (subAccounts ?? []).filter((row) =>
    SYNCABLE_STATUSES.has(String(row.status ?? "").toLowerCase())
  );

  if (syncable.length === 0) {
    return {
      ok: true,
      usableBalance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      syncedAt: null,
      skipped: true,
      reason: "No active sub-accounts",
      subAccountWallets: [],
    };
  }

  const syncErrors: string[] = [];
  for (const row of syncable) {
    const result = await syncSubAccountWalletBalance(admin, organizationId, env, row);
    if (!result.ok && result.error) syncErrors.push(result.error);
  }

  const activeIds = new Set(syncable.map((r) => String(r.id)));
  let aggregateRow: Record<string, unknown>;
  try {
    aggregateRow = await upsertAggregateFromSubWallets(admin, organizationId, activeIds);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Aggregate sync failed";
    return {
      ok: false,
      usableBalance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      syncedAt: null,
      error: message,
    };
  }

  const enrichedWallets = await listSubAccountWalletSnapshots(admin, organizationId);

  return {
    ok: syncErrors.length === 0,
    usableBalance: Number(aggregateRow.usable_balance ?? 0),
    pendingBalance: Number(aggregateRow.pending_balance ?? 0),
    totalBalance: Number(aggregateRow.total_balance ?? 0),
    syncedAt: aggregateRow.synced_at ? String(aggregateRow.synced_at) : null,
    error: syncErrors[0],
    subAccountWallets: enrichedWallets,
  };
}

export async function listSubAccountWalletSnapshots(
  admin: SupabaseClient,
  organizationId: string,
): Promise<XenditSubAccountWalletRow[]> {
  const { data: wallets, error } = await admin
    .from("xendit_sub_account_wallets")
    .select("*")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  const { data: subAccounts } = await admin
    .from("xendit_sub_accounts")
    .select("id, email, business_name, is_primary, status")
    .eq("organization_id", organizationId);

  const metaByRowId = new Map<string, Record<string, unknown>>();
  for (const sa of subAccounts ?? []) {
    metaByRowId.set(String(sa.id), sa as Record<string, unknown>);
  }

  return (wallets ?? []).map((w) => {
    const meta = metaByRowId.get(String(w.sub_account_row_id)) ?? {};
    return {
      id: String(w.id),
      organization_id: String(w.organization_id),
      sub_account_row_id: String(w.sub_account_row_id),
      xendit_sub_account_id: String(w.xendit_sub_account_id),
      usable_balance: Number(w.usable_balance ?? 0),
      pending_balance: Number(w.pending_balance ?? 0),
      total_balance: Number(w.total_balance ?? 0),
      currency: String(w.currency ?? "IDR"),
      synced_at: w.synced_at ? String(w.synced_at) : null,
      sync_error: w.sync_error ? String(w.sync_error) : null,
      email: meta.email ? String(meta.email) : undefined,
      business_name: meta.business_name ? String(meta.business_name) : undefined,
      is_primary: Boolean(meta.is_primary),
      status: meta.status ? String(meta.status) : undefined,
    };
  });
}

/** @deprecated Use syncAllOrgXenditWallets */
export async function syncOrgXenditWalletBalance(
  admin: SupabaseClient,
  organizationId: string,
  env: XenditEnvConfig,
): Promise<XenditWalletSyncResult> {
  return syncAllOrgXenditWallets(admin, organizationId, env);
}

export async function handleXenditGetBalance(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  xenditJsonFn: (body: object, status: number) => Response,
): Promise<Response> {
  const result = await syncAllOrgXenditWallets(admin, organizationId, env);
  if (result.skipped) {
    return xenditJsonFn({
      ok: true,
      skipped: true,
      reason: result.reason,
      wallet: result,
      sub_account_wallets: result.subAccountWallets ?? [],
      aggregate: {
        usableBalance: result.usableBalance,
        pendingBalance: result.pendingBalance,
        totalBalance: result.totalBalance,
        syncedAt: result.syncedAt,
      },
    }, 200);
  }
  if (!result.ok && result.error && result.totalBalance === 0 && !result.syncedAt) {
    return xenditJsonFn({ ok: false, error: result.error, wallet: result }, 200);
  }
  return xenditJsonFn({
    ok: true,
    wallet: {
      ok: result.ok,
      usableBalance: result.usableBalance,
      pendingBalance: result.pendingBalance,
      totalBalance: result.totalBalance,
      syncedAt: result.syncedAt,
      error: result.error,
    },
    aggregate: {
      usableBalance: result.usableBalance,
      pendingBalance: result.pendingBalance,
      totalBalance: result.totalBalance,
      syncedAt: result.syncedAt,
    },
    sub_account_wallets: result.subAccountWallets ?? [],
  }, 200);
}
