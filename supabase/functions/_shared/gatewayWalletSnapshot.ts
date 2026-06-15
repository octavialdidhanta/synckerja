import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type GatewayWalletProvider = "brick" | "xendit";

export type GatewayWalletSnapshotInput = {
  usable_balance: number;
  pending_balance: number;
  total_balance: number;
  currency?: string;
  sync_error?: string | null;
  raw_payload?: Record<string, unknown> | null;
};

export async function upsertGatewayWalletSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  provider: GatewayWalletProvider,
  snapshot: GatewayWalletSnapshotInput,
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const row = {
    organization_id: organizationId,
    provider,
    usable_balance: snapshot.usable_balance,
    pending_balance: snapshot.pending_balance,
    total_balance: snapshot.total_balance,
    currency: snapshot.currency ?? "IDR",
    synced_at: snapshot.sync_error ? null : now,
    sync_error: snapshot.sync_error ?? null,
    raw_payload: snapshot.raw_payload ?? null,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("organization_gateway_wallets")
    .upsert(row, { onConflict: "organization_id,provider" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function orgHasLinkedBrickAccount(
  admin: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from("bank_accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("brick_link_status", "linked");
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
