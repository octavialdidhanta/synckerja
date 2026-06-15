import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useBrickLinkedAccounts } from '@/4-1-transaction/hooks/useBrickLinkedAccounts';
import { fetchBrickWalletBalance } from '@/4-1-transaction/lib/brickBankApi';
import { fetchXenditWalletBalance, pollXenditDisbursements } from '@/xendit/lib/xenditApi';
import { useXenditOrgSettings } from '@/xendit/hooks/useXenditOrgSettings';
import { supabase } from '@/shared/lib/supabaseClient';

export type GatewayWalletRow = {
  organization_id: string;
  provider: 'brick' | 'xendit';
  usable_balance: number;
  pending_balance: number;
  total_balance: number;
  currency: string;
  synced_at: string | null;
  sync_error: string | null;
  updated_at: string;
};

const STALE_SYNC_MS = 15 * 60 * 1000;

function isSnapshotStale(row: GatewayWalletRow | null | undefined): boolean {
  if (!row?.synced_at) return true;
  if (row.sync_error) return true;
  return Date.now() - new Date(row.synced_at).getTime() > STALE_SYNC_MS;
}

export function useGatewayWalletBalances(options?: { autoSync?: boolean }) {
  const autoSync = options?.autoSync !== false;
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { hasLinkedAccount, loading: brickLinksLoading } = useBrickLinkedAccounts();
  const { data: xenditSettings, isLoading: xenditSettingsLoading } = useXenditOrgSettings(organizationId);
  const brickAutoSyncRef = useRef(false);
  const xenditAutoSyncRef = useRef(false);
  const [syncingBrick, setSyncingBrick] = useState(false);
  const [syncingXendit, setSyncingXendit] = useState(false);

  const brickEligible = hasLinkedAccount;
  const xenditEligible = Boolean(
    xenditSettings?.account?.is_enabled && xenditSettings?.account?.xendit_sub_account_id,
  );

  const invalidateGatewaySnapshots = useCallback(async () => {
    if (!organizationId) return;
    await queryClient.invalidateQueries({ queryKey: ['gateway-wallet-balances', organizationId] });
  }, [organizationId, queryClient]);

  const syncBrickWallet = useCallback(async () => {
    if (!organizationId || !brickEligible || syncingBrick) return;
    setSyncingBrick(true);
    try {
      await fetchBrickWalletBalance(organizationId);
    } catch {
      // sync_error stored server-side
    } finally {
      await invalidateGatewaySnapshots();
      setSyncingBrick(false);
    }
  }, [organizationId, brickEligible, syncingBrick, invalidateGatewaySnapshots]);

  const syncXenditWallet = useCallback(async () => {
    if (!organizationId || !xenditEligible || syncingXendit) return;
    setSyncingXendit(true);
    try {
      try {
        await pollXenditDisbursements(organizationId);
      } catch {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: stuckRows } = await supabase
          .from('xendit_disbursements')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('source_type', 'purchase_request')
          .in('status', ['pending', 'processing'])
          .gte('created_at', since);
        for (const row of stuckRows ?? []) {
          await supabase.rpc('reconcile_xendit_disbursement_completed', {
            p_disbursement_id: row.id,
          });
        }
      }
      await fetchXenditWalletBalance(organizationId);
    } catch {
      // sync_error stored server-side
    } finally {
      await invalidateGatewaySnapshots();
      if (organizationId) {
        await queryClient.invalidateQueries({ queryKey: ['gateway-wallet-period-net', organizationId] });
        await queryClient.invalidateQueries({ queryKey: ['bank-statement-lines', organizationId] });
        await queryClient.invalidateQueries({ queryKey: ['purchase-requests', organizationId] });
      }
      setSyncingXendit(false);
    }
  }, [organizationId, xenditEligible, syncingXendit, invalidateGatewaySnapshots, queryClient]);

  const query = useQuery({
    queryKey: ['gateway-wallet-balances', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as GatewayWalletRow[];
      const { data, error } = await supabase
        .from('organization_gateway_wallets')
        .select(
          'organization_id, provider, usable_balance, pending_balance, total_balance, currency, synced_at, sync_error, updated_at',
        )
        .eq('organization_id', organizationId);
      if (error) throw error;
      return (data ?? []) as GatewayWalletRow[];
    },
    enabled: Boolean(organizationId),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  const brick = useMemo(
    () => query.data?.find((r) => r.provider === 'brick') ?? null,
    [query.data],
  );
  const xendit = useMemo(
    () => query.data?.find((r) => r.provider === 'xendit') ?? null,
    [query.data],
  );

  useEffect(() => {
    brickAutoSyncRef.current = false;
    xenditAutoSyncRef.current = false;
  }, [organizationId]);

  useEffect(() => {
    if (!autoSync || !organizationId || query.isLoading || !brickEligible) return;
    const needBrick = isSnapshotStale(brick) || Boolean(brick?.sync_error);
    if (!needBrick || brickAutoSyncRef.current || syncingBrick) return;
    brickAutoSyncRef.current = true;

    void (async () => {
      try {
        await fetchBrickWalletBalance(organizationId);
      } catch {
        // Edge function persists sync_error on failure.
      } finally {
        await invalidateGatewaySnapshots();
        brickAutoSyncRef.current = false;
      }
    })();
  }, [
    autoSync,
    organizationId,
    brickEligible,
    brick?.synced_at,
    brick?.sync_error,
    query.isLoading,
    syncingBrick,
    invalidateGatewaySnapshots,
  ]);

  useEffect(() => {
    if (!autoSync || !organizationId || query.isLoading || !xenditEligible) return;
    const needXendit = isSnapshotStale(xendit) || Boolean(xendit?.sync_error);
    if (!needXendit || xenditAutoSyncRef.current || syncingXendit) return;
    xenditAutoSyncRef.current = true;

    void (async () => {
      try {
        await fetchXenditWalletBalance(organizationId);
      } catch {
        // Edge function persists sync_error on failure.
      } finally {
        await invalidateGatewaySnapshots();
        xenditAutoSyncRef.current = false;
      }
    })();
  }, [
    autoSync,
    organizationId,
    xenditEligible,
    xendit?.synced_at,
    xendit?.sync_error,
    query.isLoading,
    syncingXendit,
    invalidateGatewaySnapshots,
  ]);

  return {
    brick,
    xendit,
    brickEligible,
    xenditEligible,
    isLoading: query.isLoading || brickLinksLoading || xenditSettingsLoading,
    isPending: query.isPending,
    isStaleBrick: brickEligible && isSnapshotStale(brick),
    isStaleXendit: xenditEligible && isSnapshotStale(xendit),
    syncingBrick,
    syncingXendit,
    syncBrickWallet,
    syncXenditWallet,
    refetch: query.refetch,
  };
}
