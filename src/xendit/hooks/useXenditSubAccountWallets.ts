import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { fetchXenditWalletBalance } from "@/xendit/lib/xenditApi";
import type { XenditSubAccountWallet, XenditWalletAggregate } from "@/xendit/types/xendit";

const EMPTY_AGGREGATE: XenditWalletAggregate = {
  usableBalance: 0,
  pendingBalance: 0,
  totalBalance: 0,
  syncedAt: null,
};

async function fetchAggregateSnapshot(organizationId: string): Promise<XenditWalletAggregate> {
  const { data, error } = await supabase
    .from("organization_gateway_wallets")
    .select("usable_balance, pending_balance, total_balance, synced_at")
    .eq("organization_id", organizationId)
    .eq("provider", "xendit")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return EMPTY_AGGREGATE;
  return {
    usableBalance: Number(data.usable_balance ?? 0),
    pendingBalance: Number(data.pending_balance ?? 0),
    totalBalance: Number(data.total_balance ?? 0),
    syncedAt: data.synced_at ? String(data.synced_at) : null,
  };
}

async function fetchSubAccountWalletRows(organizationId: string): Promise<XenditSubAccountWallet[]> {
  const { data: wallets, error } = await supabase
    .from("xendit_sub_account_wallets")
    .select("*")
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  const { data: subAccounts } = await supabase
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

export function useXenditSubAccountWallets(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean; syncOnMount?: boolean },
) {
  const enabled = Boolean(organizationId && (options?.enabled !== false));
  const syncOnMount = options?.syncOnMount !== false;

  return useQuery({
    queryKey: ["xendit-akun-wallets", organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return { aggregate: EMPTY_AGGREGATE, wallets: [] as XenditSubAccountWallet[] };
      }
      if (syncOnMount) {
        try {
          await fetchXenditWalletBalance(organizationId);
        } catch {
          // server stores sync_error; still read snapshots
        }
      }
      const [aggregate, wallets] = await Promise.all([
        fetchAggregateSnapshot(organizationId),
        fetchSubAccountWalletRows(organizationId),
      ]);
      return { aggregate, wallets };
    },
    enabled,
    staleTime: 15_000,
  });
}

export function usePrimarySubAccountWallet(wallets: XenditSubAccountWallet[] | undefined) {
  return wallets?.find((w) => w.is_primary) ?? wallets?.[0] ?? null;
}
