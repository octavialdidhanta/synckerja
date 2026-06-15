import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBrickWalletBalance, readBrickEnv, type BrickEnv } from "../../_shared/brick/brickApi.ts";
import {
  orgHasLinkedBrickAccount,
  upsertGatewayWalletSnapshot,
} from "../../_shared/gatewayWalletSnapshot.ts";
import { brickJson } from "../brickAuth.ts";

export type BrickWalletSyncResult = {
  ok: boolean;
  usableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  syncedAt: string | null;
  error?: string;
  skipped?: boolean;
  reason?: string;
};

function humanizeBrickWalletError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("upstream server") || lower.includes("service is not available")) {
    return "Brick sandbox tidak merespons saat mengambil saldo wallet. Coba lagi nanti.";
  }
  return message;
}

export async function syncOrgBrickWalletBalance(
  admin: SupabaseClient,
  organizationId: string,
  env?: BrickEnv | null,
): Promise<BrickWalletSyncResult> {
  const brickEnv = env ?? readBrickEnv();
  if (!brickEnv) {
    return { ok: false, usableBalance: 0, pendingBalance: 0, totalBalance: 0, syncedAt: null, error: "Brick not configured" };
  }

  const hasLinked = await orgHasLinkedBrickAccount(admin, organizationId);
  if (!hasLinked) {
    return {
      ok: true,
      usableBalance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      syncedAt: null,
      skipped: true,
      reason: "No linked Brick bank account",
    };
  }

  try {
    const balance = await getBrickWalletBalance(brickEnv);
    const row = await upsertGatewayWalletSnapshot(admin, organizationId, "brick", {
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
    const message = humanizeBrickWalletError(e instanceof Error ? e.message : "Brick wallet sync failed");
    const { data: existing } = await admin
      .from("organization_gateway_wallets")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("provider", "brick")
      .maybeSingle();

    if (existing?.organization_id) {
      await admin
        .from("organization_gateway_wallets")
        .update({ sync_error: message, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId)
        .eq("provider", "brick");
    } else {
      await upsertGatewayWalletSnapshot(admin, organizationId, "brick", {
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

export async function handleBrickGetBalance(
  admin: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const organizationId = String(body.organizationId ?? "");
  const result = await syncOrgBrickWalletBalance(admin, organizationId);
  if (result.skipped) {
    return brickJson({ ok: true, skipped: true, reason: result.reason }, 200);
  }
  if (!result.ok) {
    return brickJson({ ok: false, error: result.error, wallet: result }, 200);
  }
  return brickJson({ ok: true, wallet: result }, 200);
}
