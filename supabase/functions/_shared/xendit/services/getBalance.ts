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

export type XenditWalletSyncResult = {
  ok: boolean;
  usableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  syncedAt: string | null;
  error?: string;
  skipped?: boolean;
  reason?: string;
};

export async function syncOrgXenditWalletBalance(
  admin: SupabaseClient,
  organizationId: string,
  env: XenditEnvConfig,
): Promise<XenditWalletSyncResult> {
  const { data: account, error } = await admin
    .from("organization_xendit_accounts")
    .select("xendit_sub_account_id, is_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      usableBalance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      syncedAt: null,
      error: error.message,
    };
  }

  if (!account?.is_enabled || !account.xendit_sub_account_id) {
    return {
      ok: true,
      usableBalance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      syncedAt: null,
      skipped: true,
      reason: "Xendit not enabled or sub-account missing",
    };
  }

  const subAccountId = String(account.xendit_sub_account_id);

  try {
    const balance = await fetchXenditWalletBalance(env, subAccountId);
    const row = await upsertGatewayWalletSnapshot(admin, organizationId, "xendit", {
      usable_balance: balance.usableBalance,
      pending_balance: balance.pendingBalance,
      total_balance: balance.totalBalance,
      sync_error: null,
      raw_payload: balance.raw,
    });

    return {
      ok: true,
      usableBalance: balance.usableBalance,
      pendingBalance: balance.pendingBalance,
      totalBalance: balance.totalBalance,
      syncedAt: row.synced_at ? String(row.synced_at) : new Date().toISOString(),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Xendit wallet sync failed";
    const { data: existing } = await admin
      .from("organization_gateway_wallets")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("provider", "xendit")
      .maybeSingle();

    if (existing?.organization_id) {
      await admin
        .from("organization_gateway_wallets")
        .update({ sync_error: message, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId)
        .eq("provider", "xendit");
    } else {
      await upsertGatewayWalletSnapshot(admin, organizationId, "xendit", {
        usable_balance: 0,
        pending_balance: 0,
        total_balance: 0,
        sync_error: message,
        raw_payload: null,
      });
    }

    return {
      ok: false,
      usableBalance: Number(existing?.usable_balance ?? 0),
      pendingBalance: Number(existing?.pending_balance ?? 0),
      totalBalance: Number(existing?.total_balance ?? 0),
      syncedAt: existing?.synced_at ? String(existing.synced_at) : null,
      error: message,
    };
  }
}

export async function handleXenditGetBalance(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  xenditJsonFn: (body: object, status: number) => Response,
): Promise<Response> {
  const result = await syncOrgXenditWalletBalance(admin, organizationId, env);
  if (result.skipped) {
    return xenditJsonFn({ ok: true, skipped: true, reason: result.reason }, 200);
  }
  if (!result.ok) {
    return xenditJsonFn({ ok: false, error: result.error, wallet: result }, 200);
  }
  return xenditJsonFn({ ok: true, wallet: result }, 200);
}
